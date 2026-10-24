# Margarita's Glow — tienda online para Netlify

Proyecto full-stack para el emprendimiento Margarita's Glow. La interfaz está hecha con React, TypeScript, Vite y Tailwind CSS; los datos persistentes usan PostgreSQL/Supabase; las operaciones privadas se ejecutan mediante Netlify Functions.

> **Estado honesto de la entrega:** el proyecto incluye código, migración SQL, configuración de Netlify, RLS, funciones serverless y pruebas unitarias del cálculo de cantidades/subtotales. No está conectado todavía a una cuenta real de Supabase o Netlify, porque esas cuentas y credenciales no se proporcionaron. Por eso no tiene productos comerciales cargados ni afirma que el despliegue esté realizado. Antes de recibir pedidos reales hay que completar la configuración externa y ejecutar las pruebas indicadas abajo.

## Funciones incluidas

- Inicio y catálogo responsive, búsqueda por nombre, filtros por categoría/marca/precio/stock, orden por precio/novedad/nombre y fichas individuales.
- Carrito persistente en el navegador. El servidor vuelve a validar precios, variantes y stock antes de guardar un pedido.
- Creación transaccional de pedidos en PostgreSQL, bloqueo de inventario, historial de precios por artículo e idempotencia para evitar duplicados por reintento.
- Costos de envío configurables como tarifa fija, gratis o a confirmar. Si la tarifa sigue pendiente, el total definitivo no se presenta como confirmado.
- Transferencia bancaria manual. Los datos bancarios se consultan en servidor solamente después de crear un pedido que seleccionó ese medio; no se cargan desde el catálogo ni la portada.
- Administración mediante Supabase Auth más autorización de servidor con `admin_users`: productos, SKU, categorías, marcas, fotos, inventario, variantes, pedidos, estados de pago, tarifas, preguntas frecuentes, avisos promocionales con vigencia, opiniones y métricas básicas.
- Reseñas moderadas; una opinión se marca como compra verificada únicamente si el pedido coincidente consta como entregado y coincide el teléfono y el producto.
- Páginas informativas editables para privacidad, condiciones, cambios/devoluciones y FAQ. Las políticas vienen como plantillas y están marcadas para revisión; no se deben publicar sin adaptarlas a las prácticas reales y a la normativa vigente.
- Accesibilidad básica, mensajes de carga/error, navegación por teclado, metadatos, `robots.txt` y generación de sitemap cuando se configura `SITE_URL`.

## Requisitos

- Node.js 22.12 o superior.
- npm.
- Proyecto de Supabase.
- Sitio en Netlify para publicar (o Netlify CLI para ejecutar las Functions en local).
- Git para el método de despliegue recomendado.

## 1. Instalación local

```bash
npm install
cp .env.example .env
```

Completá los valores reales en `.env`. El archivo está ignorado por Git. Para desarrollo local, la URL y clave pública las usa Vite; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las leen únicamente las Functions. **Nunca agregues la clave de servicio al prefijo `VITE_`.**

Iniciar únicamente el frontend:

```bash
npm run dev
```

Para probar también las Netlify Functions, instalá la CLI oficial si todavía no se instaló con las dependencias:

```bash
npx netlify dev
```

Con la configuración incluida, Netlify CLI publica el frontend de Vite en `http://localhost:8888` y enruta `/.netlify/functions/*` hacia las funciones del proyecto. No pruebes el checkout real si todavía no conectaste Supabase.

## 2. Crear y conectar Supabase

1. Creá un proyecto en Supabase y guardá su URL y las claves de API en un gestor seguro.
2. En el panel de Supabase, abrí **SQL Editor** y ejecutá el contenido de `supabase/migrations/202610240001_initial_schema.sql`. Alternativamente, podés vincular este repositorio a Supabase CLI y ejecutar `supabase db push` después de revisar el proyecto vinculado.
3. La migración crea tablas, categorías iniciales, opciones de transporte, configuración pública de la tienda, `payment_details` privado, políticas RLS y la función transaccional `place_store_order`.
4. En **Project Settings → API**, copiá la URL y la clave pública/anon correspondiente. Copiá la clave secreta/`service_role` solamente al entorno privado de las Functions. Nunca la pongas en React.
5. En Storage se crea el bucket público `product-images`, limitado a imágenes JPG, PNG, WEBP y AVIF de hasta 5 MB. El público puede leer las fotos; las subidas y eliminaciones pasan por funciones autorizadas.
6. Confirmá que la migración se ejecutó sin errores. Si ejecutás el SQL manualmente por segunda vez, no vuelvas a crear objetos a ciegas: las tablas y triggers tienen nombres explícitos y algunas políticas son de creación única en el proyecto.

### Variables de entorno

Copiá `.env.example` a `.env` y completá:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_O_PUBLISHABLE_KEY
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SECRET_SERVICE_ROLE_KEY
# Completá esta variable solo con la URL real después del primer despliegue.
SITE_URL=
```

Los ejemplos anteriores son marcadores, no credenciales válidas. La clave `SUPABASE_SERVICE_ROLE_KEY` debe ser una clave real de servidor y no puede aparecer en bundles, commits, capturas ni mensajes a clientas. La web es pública, de modo que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` no son secretos; su seguridad depende de las políticas y permisos de la base.

## 3. Crear el primer usuario administrador

No hay una contraseña por defecto ni un usuario administrativo incrustado en el código.

1. En Supabase, habilitá el método de inicio de sesión por email/contraseña en Auth.
2. Creá manualmente el usuario propietario desde **Authentication → Users → Add user**. Usá un correo que controles y definí la contraseña de manera segura.
3. Copiá el UUID de ese usuario. En SQL Editor, registralo como propietario:

```sql
insert into public.admin_users (user_id, role)
values ('UUID-REAL-DEL-USUARIO', 'owner')
on conflict (user_id) do update set role = excluded.role;
```

Reemplazá `UUID-REAL-DEL-USUARIO` por el UUID real. No uses el correo como UUID. Si querés quitar permisos, eliminá esa fila de `public.admin_users`; la cuenta de Auth por sí sola no da acceso al panel.

4. Iniciá sesión en `/admin`. Las Functions verifican el JWT de Supabase y consultan `admin_users` en el servidor antes de aceptar operaciones.

## 4. Publicación en Netlify

1. Subí este directorio a un repositorio Git privado o público según tu preferencia. No subas `.env`.
2. En Netlify elegí **Add new site → Import an existing project** y conectá el repositorio.
3. Parámetros de compilación: comando `npm run build`, directorio de publicación `dist`, funciones `netlify/functions`. `netlify.toml` ya contiene estos valores y el fallback de React Router.
4. En **Site configuration → Environment variables**, configurá `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Configurá también `SITE_URL` con la URL real de Netlify (sin `/` final) para generar `sitemap.xml`; actualizala después de conectar un dominio personalizado.
5. Volvé a desplegar después de cambiar variables de entorno. La configuración del sitio no se actualiza en despliegues ya compilados de forma retroactiva.
6. Verificá las rutas `/`, `/catalogo`, `/carrito`, `/checkout`, `/admin` y las funciones de Netlify en el sitio publicado.

## 5. Primeros pasos en el panel

1. Iniciá sesión en `/admin`.
2. En **Configuración**, revisá nombre, Instagram, teléfono, ubicación, texto de portada, datos bancarios y empresas de transporte. La configuración `payment_details` permanece privada y solo se devuelve después de crear una solicitud de pedido que eligió transferencia.
3. Revisá categorías y activá las que realmente quieras ofrecer.
4. En **Productos e inventario**, cargá nombre, descripción, SKU, precio, categoría, marca, fotos y stock. Los precios promocionales deben ser menores que el precio habitual. Podés crear variantes con una por línea en el formato `Etiqueta|Stock|Precio opcional|SKU opcional`.
5. Publicá el producto cuando esté revisado. No se incluyen productos, precios, inventario ni testimonios ficticios.
6. En **Pedidos y pagos**, verificá cada pedido, confirmá el costo del envío, el estado del pago y el estado del pedido según los hechos reales. Marcar un pago como confirmado es una acción administrativa, no automática.
7. En **Opiniones**, aprobá o ocultá comentarios. No se publican automáticamente.
8. Revisá las plantillas de privacidad, condiciones y devoluciones antes de vender; esos textos requieren adaptación y revisión jurídica según corresponda.

## 6. Pruebas y verificación

```bash
npm test
npm run build
```

`npm test` contiene pruebas unitarias de subtotales y cantidades. `supabase/tests/rls_test.sql` contiene pruebas de humo para RLS y permisos de tablas sensibles; requiere el entorno de prueba de Supabase y pgTAP. En esta entrega, la instalación de paquetes no pudo completarse porque el registro de npm no respondió; por eso no declaro `npm run build` como exitoso. Sí se comprobó la sintaxis de los 31 archivos TypeScript/TSX, se ejecutaron cinco aserciones de los helpers de comercio y se probó la generación de sitemap con una URL de prueba. Volvé a ejecutar `npm install`, `npm test` y `npm run build` en un entorno con acceso al registro de npm antes de desplegar.

Las siguientes comprobaciones requieren credenciales reales y deben hacerse antes de tomar pedidos reales:

- Aplicar la migración y confirmar las políticas RLS en el proyecto conectado.
- Ejecutar un pedido de prueba con producto ficticio en un entorno de pruebas para comprobar RPC, bloqueo de inventario, pago y almacenamiento.
- Verificar inicio de sesión, acceso no autorizado y operaciones administrativas desde `/admin`.
- Comprobar la subida y eliminación de fotos en Storage.
- Probar recarga directa de rutas y funciones en Netlify.
- Hacer una prueba móvil real desde un dispositivo.

La compilación local no demuestra por sí sola que Supabase o el sitio publicado estén conectados. La entrega no incluye afirmaciones de despliegue ni de transacciones reales ejecutadas.

## 7. Arquitectura y seguridad

- Frontend estático compilado en `dist`.
- Netlify Functions bajo `netlify/functions`.
- Funciones compartidas de servidor en `netlify/lib/shared.ts`, fuera de los puntos de entrada de Functions.
- PostgreSQL/RLS/migraciones bajo `supabase/`.
- `place_store_order` calcula importes contra datos actuales, bloquea las filas de inventario y guarda artículos con instantáneas de nombre/precio. Una transacción fallida revierte tanto los artículos como el descuento del stock. La cancelación administrativa restaura el inventario de forma idempotente y registra el evento.
- No existe una página pública para buscar pedidos por UUID ni para leer los datos personales de otros pedidos.
- El costo del envío puede quedar pendiente. En ese caso no se afirma un total final y el panel permite completarlo al confirmar la tarifa.
- No hay pasarela de pago automática integrada: el pago es una transferencia manual que debe verificar la tienda.

## Archivos principales

- `src/`: interfaz React/TypeScript, catálogo, carrito, checkout y administración.
- `netlify/functions/`: creación de pedidos, administración privada, carga de imágenes y reseñas.
- `netlify/lib/shared.ts`: cliente servidor y verificación de rol administrativo.
- `supabase/migrations/`: esquema PostgreSQL, RLS y pedido transaccional.
- `supabase/tests/`: comprobaciones de seguridad para ejecutar en Supabase.
- `netlify.toml`: compilación, funciones, headers y fallback de SPA.
- `scripts/generate-sitemap.mjs`: crea sitemap solo cuando `SITE_URL` está configurada.
