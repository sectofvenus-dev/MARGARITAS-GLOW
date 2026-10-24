import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { getAdminClient, preflight, readJson, respond } from '../lib/shared';

const payloadSchema = z.object({
  items: z.array(z.object({ product_id: z.string().uuid(), variant_id: z.string().uuid().nullable().optional(), quantity: z.number().int().min(1).max(30) })).min(1).max(40),
  customer: z.object({
    full_name: z.string().trim().min(2).max(120), phone: z.string().trim().min(6).max(40),
    department: z.string().trim().min(2).max(80), locality: z.string().trim().min(2).max(100),
    address: z.string().trim().max(240).optional().default(''), postal_code: z.string().trim().max(24).optional().default(''),
    instructions: z.string().trim().max(1000).optional().default(''),
  }),
  shipping: z.object({ company_name: z.string().trim().min(2).max(100) }),
  payment_method: z.enum(['bank_transfer', 'whatsapp_coordination']),
  idempotency_key: z.string().uuid(),
});

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Método no permitido.' }, { Allow: 'POST, OPTIONS' });
  try {
    const input = payloadSchema.parse(readJson(event));
    const client = getAdminClient();
    const { data, error } = await client.rpc('place_store_order', {
      p_items: input.items,
      p_customer: input.customer,
      p_shipping: input.shipping,
      p_payment_method: input.payment_method,
      p_idempotency_key: input.idempotency_key,
    });
    if (error) {
      const known = /stock insuficiente|no está disponible|variante|carrito está vacío|datos obligatorios|cantidad no válida|seleccioná una variante/i.test(error.message);
      return respond(known ? 409 : 400, { error: known ? error.message : 'No fue posible crear el pedido. Revisá los datos e intentá nuevamente.' });
    }
    const result = data as Record<string, unknown>;
    let bankTransfer: Record<string, unknown> | undefined;
    if (input.payment_method === 'bank_transfer') {
      const { data: setting } = await client.from('store_settings').select('value').eq('key', 'payment_details').maybeSingle();
      if (setting?.value && typeof setting.value === 'object') bankTransfer = setting.value as Record<string, unknown>;
    }
    return respond(201, { order: result, bankTransfer, nextStep: 'El pedido quedó registrado. El costo del envío debe confirmarse con la tienda.' });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'Revisá los datos del pedido; hay campos incompletos o con formato incorrecto.' });
    const msg = error instanceof Error && /Falta configurar/.test(error.message) ? error.message : 'No se pudo procesar el pedido. Verificá la conexión e intentá nuevamente.';
    return respond(500, { error: msg });
  }
};
