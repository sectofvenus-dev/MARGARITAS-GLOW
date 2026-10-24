import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isSupabaseConfigured = Boolean(url && key && !url.includes('TU-PROYECTO') && !key.includes('TU_'));
export const supabase = isSupabaseConfigured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export function getFunctionUrl(name: string): string {
  return `/.netlify/functions/${name}`;
}

export async function callFunction<T>(name: string, body?: unknown, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST'): Promise<T> {
  let token: string | undefined;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }
  const response = await fetch(getFunctionUrl(name), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Ocurrió un error. Intentá nuevamente.');
  return result;
}

export function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return 'A confirmar';
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 2 }).format(Number(amount));
}

export function productPrice(product: { price: number; sale_price?: number | null }): number {
  return product.sale_price !== null && product.sale_price !== undefined ? Number(product.sale_price) : Number(product.price);
}
