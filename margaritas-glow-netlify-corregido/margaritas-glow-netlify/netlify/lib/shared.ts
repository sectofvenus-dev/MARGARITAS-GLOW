import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function respond(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): HandlerResponse {
  return { statusCode, headers: { ...corsHeaders, ...extraHeaders }, body: JSON.stringify(body) };
}

export function preflight(event: HandlerEvent): HandlerResponse | null {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  return null;
}

export function readJson(event: HandlerEvent): unknown {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { throw new Error('El cuerpo de la solicitud no contiene JSON válido.'); }
}

export function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function authorizeAdmin(event: HandlerEvent): Promise<{ client: SupabaseClient; userId: string; role: string } | null> {
  const authHeader = event.headers.authorization ?? event.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const client = getAdminClient();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: admin, error } = await client.from('admin_users').select('role').eq('user_id', authData.user.id).maybeSingle();
  if (error || !admin) return null;
  return { client, userId: authData.user.id, role: admin.role as string };
}

export function functionError(error: unknown, fallback = 'No se pudo completar la operación.'): HandlerResponse {
  const message = error instanceof Error ? error.message : fallback;
  const safe = /falta configurar/i.test(message) ? message : fallback;
  return respond(500, { error: safe });
}

export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || `producto-${Date.now()}`;
}
