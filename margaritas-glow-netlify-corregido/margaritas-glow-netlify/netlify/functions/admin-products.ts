import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { authorizeAdmin, functionError, preflight, readJson, respond, slugify } from '../lib/shared';

const variantSchema = z.object({ label: z.string().trim().min(1).max(100), sku: z.string().trim().max(80).optional().default(''), price_override: z.number().nonnegative().nullable().optional(), stock: z.number().int().min(0).max(100000) });
const productSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(2).max(180), sku: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().max(5000).optional().default(''), short_description: z.string().trim().max(300).optional().default(''),
  category_id: z.string().uuid().nullable().optional(), brand: z.string().trim().max(100).optional().default(''),
  price: z.number().nonnegative(), sale_price: z.number().nonnegative().nullable().optional(),
  is_published: z.boolean().default(false), is_featured: z.boolean().default(false), stock: z.number().int().min(0).max(100000).default(0),
  image_urls: z.array(z.string().url().max(1200)).max(12).default([]), variants: z.array(variantSchema).max(100).default([]),
});

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  const admin = await authorizeAdmin(event);
  if (!admin) return respond(401, { error: 'Iniciá sesión con una cuenta autorizada para administrar la tienda.' });
  const client = admin.client;
  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await client.from('products').select('*, categories(id,name,slug), brands(id,name), product_images(id,image_url,alt_text,position), product_variants(id,label,sku,price_override,is_active,sort_order), inventory(id,stock,variant_id)').order('created_at', { ascending: false });
      if (error) throw error;
      return respond(200, { products: data ?? [] });
    }
    const body = readJson(event) as Record<string, unknown>;
    if (event.httpMethod === 'DELETE') {
      const id = z.string().uuid().parse(body.id);
      const { error } = await client.from('products').update({ is_published: false }).eq('id', id);
      if (error) throw error;
      return respond(200, { ok: true, message: 'Producto despublicado. Se conserva el historial de pedidos.' });
    }
    if (!['POST','PATCH'].includes(event.httpMethod)) return respond(405, { error: 'Método no permitido.' });
    const input = productSchema.parse(body.product ?? body);
    if (input.sale_price !== null && input.sale_price !== undefined && input.sale_price >= input.price) {
      return respond(400, { error: 'El precio promocional debe ser menor que el precio habitual.' });
    }
    let brandId: string | null = null;
    if (input.brand.trim()) {
      const brandSlug = slugify(input.brand);
      const { data: brand, error: brandError } = await client.from('brands').upsert({ name: input.brand.trim(), slug: brandSlug }, { onConflict: 'slug' }).select('id').single();
      if (brandError) throw brandError;
      brandId = brand.id as string;
    }
    const dataToSave = {
      ...(input.id ? { id: input.id } : {}), sku: input.sku.trim() || null, name: input.name,
      slug: `${slugify(input.name)}${input.id ? `-${input.id.slice(0,6)}` : `-${Date.now().toString(36)}`}`,
      description: input.description || null, short_description: input.short_description || null,
      category_id: input.category_id || null, brand_id: brandId, price: input.price, sale_price: input.sale_price ?? null,
      is_published: input.is_published, is_featured: input.is_featured,
    };
    const mutation = input.id
      ? await client.from('products').update(dataToSave).eq('id', input.id).select('id').single()
      : await client.from('products').insert(dataToSave).select('id').single();
    if (mutation.error) throw mutation.error;
    const productId = mutation.data.id as string;

    const { data: existingImages, error: imageQueryError } = await client.from('product_images').select('id,image_url').eq('product_id', productId);
    if (imageQueryError) throw imageQueryError;
    const keepImages = input.image_urls;
    const obsolete = (existingImages ?? []).filter((img) => !keepImages.includes(img.image_url)).map((img) => img.id);
    if (obsolete.length) { const { error } = await client.from('product_images').delete().in('id', obsolete); if (error) throw error; }
    for (const [position, imageUrl] of keepImages.entries()) {
      const current = (existingImages ?? []).find((img) => img.image_url === imageUrl);
      if (current) {
        const { error } = await client.from('product_images').update({ position, alt_text: input.name }).eq('id', current.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('product_images').insert({ product_id: productId, image_url: imageUrl, alt_text: input.name, position });
        if (error) throw error;
      }
    }

    const { data: oldVariants, error: variantError } = await client.from('product_variants').select('id,label').eq('product_id', productId);
    if (variantError) throw variantError;
    const activeLabels = input.variants.map((v) => v.label);
    for (const old of oldVariants ?? []) {
      if (!activeLabels.includes(old.label)) {
        const { error } = await client.from('product_variants').update({ is_active: false }).eq('id', old.id);
        if (error) throw error;
      }
    }
    for (const [sortOrder, variant] of input.variants.entries()) {
      const old = (oldVariants ?? []).find((v) => v.label === variant.label);
      let variantId = old?.id as string | undefined;
      if (old) {
        const { error } = await client.from('product_variants').update({ sku: variant.sku || null, price_override: variant.price_override ?? null, is_active: true, sort_order: sortOrder }).eq('id', old.id);
        if (error) throw error;
      } else {
        const { data, error } = await client.from('product_variants').insert({ product_id: productId, label: variant.label, sku: variant.sku || null, price_override: variant.price_override ?? null, is_active: true, sort_order: sortOrder }).select('id').single();
        if (error) throw error; variantId = data.id as string;
      }
      const { data: inventory } = await client.from('inventory').select('id').eq('product_id', productId).eq('variant_id', variantId!).maybeSingle();
      if (inventory?.id) { const { error } = await client.from('inventory').update({ stock: variant.stock, updated_at: new Date().toISOString() }).eq('id', inventory.id); if (error) throw error; }
      else { const { error } = await client.from('inventory').insert({ product_id: productId, variant_id: variantId, stock: variant.stock }); if (error) throw error; }
    }
    if (input.variants.length === 0) {
      for (const old of oldVariants ?? []) { const { error } = await client.from('product_variants').update({ is_active: false }).eq('id', old.id); if (error) throw error; }
      const { data: inventory } = await client.from('inventory').select('id').eq('product_id', productId).is('variant_id', null).maybeSingle();
      if (inventory?.id) { const { error } = await client.from('inventory').update({ stock: input.stock, updated_at: new Date().toISOString() }).eq('id', inventory.id); if (error) throw error; }
      else { const { error } = await client.from('inventory').insert({ product_id: productId, variant_id: null, stock: input.stock }); if (error) throw error; }
    }
    return respond(200, { ok: true, id: productId, message: 'Producto guardado.' });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'Revisá los datos del producto: hay campos incompletos o con formato incorrecto.' });
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) return respond(409, { error: 'Ya existe un producto, SKU o marca con esos datos. Revisá los identificadores.' });
    return functionError(error, 'No se pudo guardar el producto. Revisá que la categoría y los datos sean correctos.');
  }
};
