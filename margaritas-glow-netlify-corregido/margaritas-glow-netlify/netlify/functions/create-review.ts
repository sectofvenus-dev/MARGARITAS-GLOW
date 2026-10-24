import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { getAdminClient, preflight, readJson, respond } from '../lib/shared';

const reviewSchema = z.object({
  product_id: z.string().uuid(), display_name: z.string().trim().min(2).max(60), rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(1200), order_number: z.string().trim().max(40).optional().default(''), phone: z.string().trim().max(40).optional().default(''),
  website: z.string().max(0).optional().default(''),
});

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Método no permitido.' });
  try {
    const input = reviewSchema.parse(readJson(event));
    const client = getAdminClient();
    const { data: product, error: productError } = await client.from('products').select('id').eq('id', input.product_id).eq('is_published', true).maybeSingle();
    if (productError || !product) return respond(404, { error: 'Ese producto ya no está disponible para reseñas.' });
    let orderItemId: string | null = null;
    let verified = false;
    if (input.order_number && input.phone) {
      const { data: order } = await client.from('orders').select('id, customers!inner(phone)').eq('order_number', input.order_number).eq('customers.phone', input.phone).eq('status', 'delivered').maybeSingle();
      if (order) {
        const { data: item } = await client.from('order_items').select('id').eq('order_id', order.id).eq('product_id', input.product_id).maybeSingle();
        if (item) { orderItemId = item.id as string; verified = true; }
      }
    }
    const { error } = await client.from('reviews').insert({ product_id: input.product_id, order_item_id: orderItemId, display_name: input.display_name, rating: input.rating, comment: input.comment, is_approved: false, is_verified_purchase: verified });
    if (error) throw error;
    return respond(201, { ok: true, verified, message: 'Gracias por compartir tu opinión. Se publicará cuando sea revisada por la tienda.' });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'Completá el nombre, una puntuación y un comentario válido.' });
    return respond(500, { error: 'No fue posible enviar la reseña. Intentá nuevamente más tarde.' });
  }
};
