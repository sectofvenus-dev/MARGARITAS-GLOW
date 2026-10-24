import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { authorizeAdmin, functionError, preflight, readJson, respond } from '../lib/shared';

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export const handler: Handler = async (event) => {
  const options = preflight(event); if (options) return options;
  const admin = await authorizeAdmin(event);
  if (!admin) return respond(401, { error: 'Iniciá sesión con una cuenta autorizada para administrar la tienda.' });
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Método no permitido.' });
  try {
    const body = readJson(event) as Record<string, unknown>;
    if (body.action === 'delete') {
      const input = z.object({ action: z.literal('delete'), storage_path: z.string().min(1).max(500) }).parse(body);
      const { error } = await admin.client.storage.from('product-images').remove([input.storage_path]);
      if (error) throw error;
      return respond(200, { ok: true });
    }
    const input = z.object({ file_name: z.string().min(1).max(180), mime_type: z.string(), base64: z.string().min(1).max(7_500_000) }).parse(body);
    if (!(input.mime_type in IMAGE_TYPES)) return respond(400, { error: 'Usá una imagen JPG, PNG, WEBP o AVIF.' });
    const buffer = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 5 * 1024 * 1024) return respond(413, { error: 'La imagen no puede superar los 5 MB.' });
    const path = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${IMAGE_TYPES[input.mime_type]}`;
    const { error } = await admin.client.storage.from('product-images').upload(path, buffer, { contentType: input.mime_type, upsert: false, cacheControl: '31536000' });
    if (error) throw error;
    const { data } = admin.client.storage.from('product-images').getPublicUrl(path);
    return respond(200, { ok: true, image_url: data.publicUrl, storage_path: path });
  } catch (error) {
    if (error instanceof z.ZodError) return respond(400, { error: 'El archivo o los datos de la imagen no son válidos.' });
    return functionError(error, 'No se pudo subir o eliminar la imagen.');
  }
};
