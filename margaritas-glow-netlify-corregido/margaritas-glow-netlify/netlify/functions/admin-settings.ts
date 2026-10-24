import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { authorizeAdmin, functionError, preflight, readJson, respond, slugify } from '../lib/shared';

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  const admin = await authorizeAdmin(event);
  if (!admin) return respond(401, { error: 'Iniciá sesión con una cuenta autorizada para administrar la tienda.' });
  const client = admin.client;
  try {
    if (event.httpMethod === 'GET') {
      const [settings, categories, shipping, reviews, stats, promotions] = await Promise.all([
        client.from('store_settings').select('*').order('key'),
        client.from('categories').select('*').order('sort_order'),
        client.from('shipping_companies').select('*').order('name'),
        client.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).limit(150),
        client.from('orders').select('id,subtotal,total_amount,payment_status,status,created_at'),
        client.from('promotions').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      const error = settings.error || categories.error || shipping.error || reviews.error || stats.error || promotions.error;
      if (error) throw error;
      return respond(200, { settings: settings.data ?? [], categories: categories.data ?? [], shipping: shipping.data ?? [], reviews: reviews.data ?? [], stats: stats.data ?? [], promotions: promotions.data ?? [] });
    }
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PATCH') return respond(405, { error: 'Método no permitido.' });
    const body = readJson(event) as Record<string, unknown>;
    const action = z.enum(['save_setting','save_shipping','save_category','review_moderation','save_promotion','delete_promotion']).parse(body.action);
    if (action === 'save_setting') {
      const input = z.object({ key: z.string().min(1).max(80), value: z.record(z.string(), z.unknown()) }).parse(body);
      const allowedKeys = new Set(['business_profile','storefront','payment_details','policy_privacy','policy_terms','policy_returns','faq']);
      if (!allowedKeys.has(input.key)) return respond(400, { error: 'Esa configuración no está permitida.' });
      const isPublic = input.key !== 'payment_details';
      const { error } = await client.from('store_settings').upsert({ key: input.key, value: input.value, is_public: isPublic, updated_at: new Date().toISOString() });
      if (error) throw error;
      return respond(200, { ok: true, message: 'Configuración guardada.' });
    }
    if (action === 'save_shipping') {
      const shippingSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), is_active: z.boolean(), cost_mode: z.enum(['fixed','confirm','free']), cost: z.number().nonnegative().nullable(), estimated_days: z.string().max(100).optional().nullable() }).superRefine((value, context) => {
        if (value.cost_mode === 'fixed' && value.cost === null) context.addIssue({ code: 'custom', path: ['cost'], message: 'Una tarifa fija necesita un importe.' });
      });
      const input = shippingSchema.parse(body);
      const row = { name: input.name, is_active: input.is_active, cost_mode: input.cost_mode, cost: input.cost_mode === 'fixed' ? input.cost : null, estimated_days: input.estimated_days || null };
      const mutation = input.id ? await client.from('shipping_companies').update(row).eq('id', input.id) : await client.from('shipping_companies').upsert(row, { onConflict: 'name' });
      if (mutation.error) throw mutation.error;
      return respond(200, { ok: true, message: 'Transporte actualizado.' });
    }
    if (action === 'save_category') {
      const input = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), is_active: z.boolean(), sort_order: z.number().int().min(0).max(1000) }).parse(body);
      const row = { name: input.name, slug: slugify(input.name), is_active: input.is_active, sort_order: input.sort_order };
      const mutation = input.id ? await client.from('categories').update(row).eq('id', input.id) : await client.from('categories').upsert(row, { onConflict: 'slug' });
      if (mutation.error) throw mutation.error;
      return respond(200, { ok: true, message: 'Categoría guardada.' });
    }
    if (action === 'save_promotion') {
      const promotionSchema = z.object({
        id: z.string().uuid().optional(), title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(700).optional().default(''),
        starts_at: z.string().datetime().nullable().optional(), ends_at: z.string().datetime().nullable().optional(),
        is_active: z.boolean(),
      }).superRefine((value, context) => {
        if (value.starts_at && value.ends_at && Date.parse(value.ends_at) < Date.parse(value.starts_at)) {
          context.addIssue({ code: 'custom', path: ['ends_at'], message: 'La fecha final debe ser posterior a la inicial.' });
        }
      });
      const input = promotionSchema.parse(body);
      const row = { title: input.title, description: input.description || null, starts_at: input.starts_at ?? null, ends_at: input.ends_at ?? null, is_active: input.is_active };
      const mutation = input.id
        ? await client.from('promotions').update(row).eq('id', input.id)
        : await client.from('promotions').insert(row);
      if (mutation.error) throw mutation.error;
      return respond(200, { ok: true, message: 'Promoción guardada.' });
    }
    if (action === 'delete_promotion') {
      const input = z.object({ id: z.string().uuid() }).parse(body);
      const { error } = await client.from('promotions').delete().eq('id', input.id);
      if (error) throw error;
      return respond(200, { ok: true, message: 'Promoción eliminada.' });
    }
    const input = z.object({ id: z.string().uuid(), is_approved: z.boolean() }).parse(body);
    const { error } = await client.from('reviews').update({ is_approved: input.is_approved }).eq('id', input.id);
    if (error) throw error;
    return respond(200, { ok: true, message: input.is_approved ? 'Opinión publicada.' : 'Opinión ocultada.' });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'Revisá los datos enviados al panel.' });
    return functionError(error, 'No se pudo guardar la configuración.');
  }
};
