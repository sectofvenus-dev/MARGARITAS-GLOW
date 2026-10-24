import type { Category, Product } from '../types';
import { supabase } from './supabase';

const PRODUCT_FIELDS = 'id,sku,name,slug,short_description,description,price,sale_price,is_published,is_featured,created_at,categories(id,name,slug,is_active),brands(id,name),product_images(id,image_url,alt_text,position),product_variants(id,label,sku,price_override,is_active,sort_order),inventory(id,stock,variant_id)';

export async function getProducts(options: { categoryId?: string; search?: string; featured?: boolean } = {}): Promise<Product[]> {
  if (!supabase) return [];
  let query = supabase.from('products').select(PRODUCT_FIELDS).eq('is_published', true).order('created_at', { ascending: false });
  if (options.categoryId) query = query.eq('category_id', options.categoryId);
  if (options.featured) query = query.eq('is_featured', true);
  if (options.search?.trim()) query = query.ilike('name', `%${options.search.trim().replace(/[%_]/g, '')}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  if (!supabase) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
  const column = isUuid ? 'id' : 'slug';
  const { data, error } = await supabase.from('products').select(PRODUCT_FIELDS).eq('is_published', true).eq(column, idOrSlug).maybeSingle();
  if (error) throw error;
  return (data as unknown as Product | null) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('categories').select('id,name,slug,description,is_active,sort_order').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getPublicSetting<T>(key: string): Promise<T | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('store_settings').select('value').eq('key', key).eq('is_public', true).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export function stockForProduct(product: Product, variantId?: string | null): number {
  return (product.inventory ?? []).filter((row) => (row.variant_id ?? null) === (variantId ?? null)).reduce((sum, row) => sum + Number(row.stock || 0), 0);
}

export function priceForVariant(product: Product, variantId?: string | null): number {
  const variant = variantId ? product.product_variants?.find((item) => item.id === variantId) : undefined;
  return Number(variant?.price_override ?? product.sale_price ?? product.price);
}

export function imageForProduct(product: Product): string | null {
  return [...(product.product_images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.image_url ?? null;
}
