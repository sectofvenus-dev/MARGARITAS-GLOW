import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { authorizeAdmin, functionError, preflight, readJson, respond } from '../lib/shared';

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending_confirmation','pending_payment','payment_confirmed','preparing','shipped','delivered','cancelled']).optional(),
  payment_status: z.enum(['pending','proof_received','confirmed','rejected','refunded']).optional(),
  shipping_cost: z.number().nonnegative().nullable().optional(),
  tracking_number: z.string().trim().max(120).optional(),
  internal_notes: z.string().trim().max(3000).optional(),
});

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  const admin = await authorizeAdmin(event);
  if (!admin) return respond(401, { error: 'Iniciá sesión con una cuenta autorizada para administrar la tienda.' });
  const client = admin.client;
  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await client.from('orders').select('*, customers(*), order_items(*), payments(*), order_events(*)').order('created_at', { ascending: false }).limit(250);
      if (error) throw error;
      return respond(200, { orders: data ?? [] });
    }
    if (event.httpMethod !== 'PATCH') return respond(405, { error: 'Método no permitido.' });
    const input = updateSchema.parse(readJson(event));
    const { data: before, error: readError } = await client.from('orders').select('*').eq('id', input.id).single();
    if (readError) throw readError;
    if (before.status === 'cancelled' && input.status && input.status !== 'cancelled') {
      return respond(409, { error: 'Un pedido cancelado no puede reabrirse desde este panel. Contactá a la propietaria para revisar el caso.' });
    }
    const resultingPaymentStatus = input.payment_status ?? before.payment_status;
    const resultingOrderStatus = input.status ?? (input.payment_status === 'confirmed' && ['pending_confirmation','pending_payment'].includes(String(before.status)) ? 'payment_confirmed' : before.status);
    if (['payment_confirmed','preparing','shipped','delivered'].includes(String(resultingOrderStatus)) && resultingPaymentStatus !== 'confirmed') {
      return respond(409, { error: 'Antes de avanzar a preparación o envío, el pago debe estar confirmado por la tienda.' });
    }
    const cancelling = input.status === 'cancelled' && before.status !== 'cancelled';
    if (cancelling) {
      const { error: cancelError } = await client.rpc('cancel_store_order', { p_order_id: input.id, p_actor: admin.userId });
      if (cancelError) {
        const known = /no se puede cancelar|no se encontró/i.test(cancelError.message);
        return respond(known ? 409 : 500, { error: known ? cancelError.message : 'No se pudo cancelar el pedido de forma segura.' });
      }
    }
    const updates: Record<string, unknown> = {};
    if (input.status && !cancelling && input.status !== before.status) updates.status = input.status;
    if (input.payment_status && input.payment_status !== before.payment_status) updates.payment_status = input.payment_status;
    if (input.shipping_cost !== undefined) {
      updates.shipping_cost = input.shipping_cost;
      updates.total_amount = input.shipping_cost === null ? null : Number(before.subtotal) + input.shipping_cost;
    }
    if (input.tracking_number !== undefined) updates.tracking_number = input.tracking_number || null;
    if (input.internal_notes !== undefined) updates.internal_notes = input.internal_notes || null;
    if (input.payment_status === 'confirmed' && ['pending_confirmation','pending_payment'].includes(String(before.status)) && !input.status) updates.status = 'payment_confirmed';
    if (Object.keys(updates).length) {
      const { error } = await client.from('orders').update(updates).eq('id', input.id);
      if (error) throw error;
    }
    if (input.shipping_cost !== undefined) {
      const { data: pendingPayment } = await client.from('payments').select('id').eq('order_id', input.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pendingPayment?.id) { const { error: amountError } = await client.from('payments').update({ amount: Number(before.subtotal) + (input.shipping_cost ?? 0) }).eq('id', pendingPayment.id); if (amountError) throw amountError; }
    }
    if (input.payment_status) {
      const { data: payment } = await client.from('payments').select('id').eq('order_id', input.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (payment?.id) { const { error: paymentError } = await client.from('payments').update({ status: input.payment_status }).eq('id', payment.id); if (paymentError) throw paymentError; }
    }
    const changedStatus = input.status && input.status !== before.status && !cancelling;
    const changedPayment = input.payment_status && input.payment_status !== before.payment_status;
    if (changedStatus || changedPayment) {
      const details = [changedStatus ? `Estado del pedido: ${input.status}` : '', changedPayment ? `Pago: ${input.payment_status}` : ''].filter(Boolean).join('. ');
      const { error: eventError } = await client.from('order_events').insert({ order_id: input.id, actor: admin.userId, event_type: 'admin_update', message: details });
      if (eventError) throw eventError;
    }
    return respond(200, { ok: true, message: 'Pedido actualizado.' });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'Los datos de actualización no son válidos.' });
    return functionError(error, 'No se pudo actualizar el pedido.');
  }
};
