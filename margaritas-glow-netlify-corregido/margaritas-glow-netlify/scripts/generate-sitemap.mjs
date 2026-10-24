import { writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const siteUrl = process.env.SITE_URL?.replace(/\/$/, '');
const publicDir = resolve('public');
await mkdir(publicDir, { recursive: true });
if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
  await rm(resolve(publicDir, 'sitemap.xml'), { force: true });
  console.log('SITE_URL no está configurada: se omite sitemap.xml para no publicar una URL inventada.');
} else {
  const paths = ['/', '/catalogo', '/preguntas-frecuentes', '/privacidad', '/condiciones', '/cambios-y-devoluciones'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(resolve(publicDir, 'sitemap.xml'), xml);
  console.log(`Sitemap generado para ${siteUrl}`);
}
