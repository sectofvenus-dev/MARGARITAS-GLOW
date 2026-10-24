-- Margarita's Glow: esquema inicial. Ejecutar en Supabase SQL Editor o con Supabase CLI.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or (sale_price >= 0 and sale_price < price)),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  sku text unique,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, label)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  stock integer not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_product_without_variant_uq
  on public.inventory(product_id) where variant_id is null;
create unique index if not exists inventory_product_variant_uq
  on public.inventory(product_id, variant_id) where variant_id is not null;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  department text not null,
  locality text not null,
  address text,
  postal_code text,
  instructions text,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  cost numeric(12,2) check (cost is null or cost >= 0),
  cost_mode text not null default 'confirm' check (cost_mode in ('fixed','confirm','free')),
  estimated_days text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key text not null unique,
  customer_id uuid not null references public.customers(id),
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','pending_payment','payment_confirmed','preparing','shipped','delivered','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','proof_received','confirmed','rejected','refunded')),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','whatsapp_coordination')),
  shipping_company_id uuid references public.shipping_companies(id) on delete set null,
  shipping_company_name text not null,
  shipping_cost numeric(12,2) check (shipping_cost is null or shipping_cost >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  tracking_number text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null,
  variant_label_snapshot text,
  sku_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null default 'bank_transfer',
  status text not null default 'pending' check (status in ('pending','proof_received','confirmed','rejected','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  proof_url text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor text not null default 'system',
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  display_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  is_approved boolean not null default false,
  is_verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists shipping_companies_set_updated_at on public.shipping_companies;
create trigger shipping_companies_set_updated_at before update on public.shipping_companies for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at before update on public.promotions for each row execute function public.set_updated_at();

-- Datos iniciales no comerciales: categorías y medios de transporte nombrados por la propietaria.
insert into public.categories (name, slug, sort_order) values
 ('Rostro','rostro',1), ('Ojos','ojos',2), ('Labios','labios',3),
 ('Herramientas de belleza','herramientas-de-belleza',4), ('Skincare','skincare',5),
 ('Accesorios','accesorios',6), ('Combos','combos',7)
on conflict (slug) do nothing;

insert into public.shipping_companies (name, cost_mode) values
 ('La Nave','confirm'), ('UES','confirm'), ('Norteño','confirm'), ('Correo Uruguayo','confirm'), ('Otra empresa','confirm')
on conflict (name) do nothing;

insert into public.store_settings (key, value, is_public) values
 ('business_profile', '{"name":"Margarita''s Glow","instagram":"https://www.instagram.com/margaritasglow.uy/","phone":"099782589","location":"Villa Constitución, Salto, Uruguay","shipping_message":"Envíos a todo Uruguay"}'::jsonb, true),
 ('payment_details', '{"holder":"Melany Cardozo","bank":"BROU","account_number":"110984406-00001","instructions":"Después de realizar la transferencia, enviá el comprobante por WhatsApp."}'::jsonb, false),
 ('storefront', '{"hero_title":"Tu próximo favorito está acá","hero_subtitle":"Maquillaje, belleza y accesorios elegidos con cariño.","announcement":"Envíos a todo Uruguay","show_featured":true}'::jsonb, true),
 ('faq', '{"items":[{"question":"¿Hacen envíos a todo Uruguay?","answer":"Sí, coordinamos envíos a todo Uruguay. La empresa disponible y el costo dependen de la localidad; te confirmamos estos datos antes de que realices el pago definitivo."},{"question":"¿Cuándo queda confirmado mi pedido?","answer":"Cuando recibimos la solicitud, verificamos los productos y coordinamos el envío. El pedido no figura como pagado hasta que la tienda compruebe la transferencia."},{"question":"¿Cómo envío el comprobante?","answer":"Después de realizar la transferencia, escribinos por WhatsApp y adjuntá el comprobante."}]}'::jsonb, true),
 ('policy_privacy', '{"title":"Política de privacidad","content":"Este documento es una plantilla inicial y debe revisarse antes de publicar. La tienda debe explicar qué datos personales recoge durante un pedido, para qué los utiliza, cuánto tiempo los conserva, con quién los comparte para coordinar la entrega y cómo una persona puede ejercer sus derechos.\n\nNo agregues información que no refleje las prácticas reales del negocio. Completá y validá este texto antes de habilitar las ventas.","needs_review":true}'::jsonb, true),
 ('policy_terms', '{"title":"Condiciones de compra","content":"Este documento es una plantilla inicial y necesita revisión antes de publicar. Debe describir cómo se crea un pedido, cuándo se confirma, cómo se informan los precios, cuándo se define el costo del envío y qué métodos de pago están realmente disponibles.\n\nLa creación de una solicitud no significa que el pago esté confirmado ni que el pedido ya haya sido enviado.","needs_review":true}'::jsonb, true),
 ('policy_returns', '{"title":"Cambios y devoluciones","content":"Este documento es una plantilla inicial y debe revisarse para ajustarse a la normativa aplicable y a las prácticas reales del emprendimiento. Definí cómo se gestionan los reclamos, los productos dañados o incorrectos, los plazos, las condiciones de devolución y el canal de contacto.\n\nNo publiques plazos ni excepciones que la tienda no pueda cumplir.","needs_review":true}'::jsonb, true)
on conflict (key) do nothing;

-- RLS en todas las tablas de la aplicación.
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.shipping_companies enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.store_settings enable row level security;
alter table public.promotions enable row level security;

-- No hay escrituras directas desde el navegador. Las mutaciones pasan por Functions.
revoke all on public.categories, public.brands, public.products, public.product_variants,
 public.inventory, public.product_images, public.customers, public.shipping_companies,
 public.orders, public.order_items, public.payments, public.order_events, public.reviews,
 public.admin_users, public.store_settings, public.promotions from anon, authenticated;

grant select on public.categories, public.brands, public.products, public.product_variants,
 public.inventory, public.product_images, public.shipping_companies, public.reviews,
 public.store_settings, public.promotions to anon, authenticated;

drop policy if exists "active categories are public" on public.categories;
create policy "active categories are public" on public.categories for select to anon, authenticated using (is_active);
drop policy if exists "brands used by published products are public" on public.brands;
create policy "brands used by published products are public" on public.brands for select to anon, authenticated using (
 exists (select 1 from public.products p where p.brand_id = brands.id and p.is_published)
);
drop policy if exists "published products are public" on public.products;
create policy "published products are public" on public.products for select to anon, authenticated using (is_published);
drop policy if exists "active variants of published products are public" on public.product_variants;
create policy "active variants of published products are public" on public.product_variants for select to anon, authenticated using (
 is_active and exists (select 1 from public.products p where p.id = product_variants.product_id and p.is_published)
);
drop policy if exists "stock only for published products is public" on public.inventory;
create policy "stock only for published products is public" on public.inventory for select to anon, authenticated using (
 exists (select 1 from public.products p where p.id = inventory.product_id and p.is_published)
);
drop policy if exists "images of published products are public" on public.product_images;
create policy "images of published products are public" on public.product_images for select to anon, authenticated using (
 exists (select 1 from public.products p where p.id = product_images.product_id and p.is_published)
);
drop policy if exists "active shipping companies are public" on public.shipping_companies;
create policy "active shipping companies are public" on public.shipping_companies for select to anon, authenticated using (is_active);
drop policy if exists "approved reviews are public" on public.reviews;
create policy "approved reviews are public" on public.reviews for select to anon, authenticated using (is_approved);
drop policy if exists "only public store settings are public" on public.store_settings;
create policy "only public store settings are public" on public.store_settings for select to anon, authenticated using (is_public);
drop policy if exists "active promotions are public" on public.promotions;
create policy "active promotions are public" on public.promotions for select to anon, authenticated using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));

-- Bucket público para visualizar imágenes de productos. Escrituras solo desde Functions (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');

-- Pedido transaccional: vuelve a validar precio y disponibilidad en PostgreSQL y descuenta stock con bloqueo.
create or replace function public.place_store_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_payment_method text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_customer_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_inventory_id uuid;
  v_stock integer;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_company_name text;
  v_company_id uuid;
  v_shipping_mode text;
  v_shipping_cost numeric(12,2);
  v_variant_label text;
  v_sku text;
  v_existing_status text;
  v_existing_payment_status text;
  v_existing_total numeric(12,2);
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'Clave de pedido no válida';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select id, order_number, subtotal, status, payment_status into v_order_id, v_order_number, v_subtotal, v_existing_status, v_existing_payment_status from public.orders where idempotency_key = p_idempotency_key;
  if v_order_id is not null then
    select shipping_cost, total_amount into v_shipping_cost, v_existing_total from public.orders where id = v_order_id;
    return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_cost',v_shipping_cost,'total_amount',v_existing_total,'status',v_existing_status,'payment_status',v_existing_payment_status,'already_created',true);
  end if;
  v_subtotal := 0;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 40 then
    raise exception 'El carrito está vacío o contiene demasiados artículos';
  end if;
  if coalesce(trim(p_customer->>'full_name'),'') = '' or coalesce(trim(p_customer->>'phone'),'') = ''
    or coalesce(trim(p_customer->>'department'),'') = '' or coalesce(trim(p_customer->>'locality'),'') = '' then
    raise exception 'Faltan datos obligatorios de entrega';
  end if;
  if p_payment_method not in ('bank_transfer','whatsapp_coordination') then
    raise exception 'Método de pago no válido';
  end if;

  insert into public.customers(full_name,phone,department,locality,address,postal_code,instructions)
  values (trim(p_customer->>'full_name'),trim(p_customer->>'phone'),trim(p_customer->>'department'),trim(p_customer->>'locality'),
    nullif(trim(p_customer->>'address'),''),nullif(trim(p_customer->>'postal_code'),''),nullif(trim(p_customer->>'instructions'),''))
  returning id into v_customer_id;

  v_company_name := coalesce(nullif(trim(p_shipping->>'company_name'),''),'A coordinar');
  select id into v_company_id from public.shipping_companies where name = v_company_name and is_active limit 1;
  v_shipping_cost := null;
  v_shipping_mode := null;
  if v_company_id is not null then
    select cost_mode, cost into v_shipping_mode, v_shipping_cost from public.shipping_companies where id = v_company_id;
    if v_shipping_mode = 'free' then v_shipping_cost := 0;
    elsif v_shipping_mode = 'confirm' then v_shipping_cost := null;
    end if;
  end if;
  v_order_number := 'MG-' || to_char(now() at time zone 'America/Montevideo','YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.orders(order_number,idempotency_key,customer_id,status,payment_status,payment_method,shipping_company_id,shipping_company_name,shipping_cost,subtotal,total_amount)
  values(v_order_number,p_idempotency_key,v_customer_id,'pending_confirmation','pending',p_payment_method,v_company_id,v_company_name,v_shipping_cost,0,case when v_shipping_cost is null then null else v_shipping_cost end)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 30 then raise exception 'Cantidad no válida'; end if;
    select * into v_product from public.products where id = v_product_id and is_published for share;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    v_variant_label := null;
    v_sku := v_product.sku;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id = v_variant_id and product_id = v_product.id and is_active for share;
      if not found then raise exception 'Una variante ya no está disponible'; end if;
      v_variant_label := v_variant.label;
      v_sku := coalesce(v_variant.sku,v_product.sku);
      v_unit_price := coalesce(v_variant.price_override,v_product.sale_price,v_product.price);
    else
      if exists(select 1 from public.product_variants pv where pv.product_id = v_product.id and pv.is_active) then
        raise exception 'Seleccioná una variante para %', v_product.name;
      end if;
      v_unit_price := coalesce(v_product.sale_price,v_product.price);
    end if;
    select i.id, i.stock into v_inventory_id, v_stock
      from public.inventory i
      where i.product_id = v_product.id and i.variant_id is not distinct from v_variant_id
      for update;
    if not found or v_stock < v_qty then raise exception 'Stock insuficiente para %', v_product.name; end if;
    update public.inventory set stock = stock - v_qty, updated_at = now() where id = v_inventory_id;
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    insert into public.order_items(order_id,product_id,variant_id,product_name_snapshot,variant_label_snapshot,sku_snapshot,unit_price,quantity,line_total)
    values(v_order_id,v_product.id,v_variant_id,v_product.name,v_variant_label,v_sku,v_unit_price,v_qty,v_line_total);
  end loop;

  update public.orders set subtotal = v_subtotal, total_amount = case when shipping_cost is null then null else v_subtotal + shipping_cost end where id = v_order_id;
  insert into public.payments(order_id,method,status,amount) values(v_order_id,p_payment_method,'pending',case when v_shipping_cost is null then v_subtotal else v_subtotal + v_shipping_cost end);
  insert into public.order_events(order_id,actor,event_type,message)
    values(v_order_id,'system','order_created','Pedido creado. El costo de envío queda pendiente de confirmación.');
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_cost',v_shipping_cost,'total_amount',case when v_shipping_cost is null then null else v_subtotal + v_shipping_cost end,'status','pending_confirmation','payment_status','pending','already_created',false);
end;
$$;
revoke all on function public.place_store_order(jsonb,jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.place_store_order(jsonb,jsonb,jsonb,text,text) to service_role;

-- Cancelación idempotente: solo restaura el inventario una vez y registra el cambio.
create or replace function public.cancel_store_order(p_order_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status text;
  v_order_number text;
begin
  select status, order_number into v_status, v_order_number
    from public.orders where id = p_order_id for update;
  if not found then raise exception 'No se encontró el pedido'; end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', true, 'already_cancelled', true, 'order_number', v_order_number);
  end if;
  if v_status in ('shipped','delivered') then
    raise exception 'No se puede cancelar desde el panel un pedido ya enviado o entregado';
  end if;

  update public.inventory i set stock = i.stock + oi.quantity, updated_at = now()
    from (select product_id, variant_id, sum(quantity)::integer as quantity
          from public.order_items where order_id = p_order_id and product_id is not null
          group by product_id, variant_id) oi
    where i.product_id = oi.product_id and i.variant_id is not distinct from oi.variant_id;

  insert into public.inventory(product_id, variant_id, stock)
    select oi.product_id, oi.variant_id, oi.quantity
    from (select product_id, variant_id, sum(quantity)::integer as quantity
          from public.order_items where order_id = p_order_id and product_id is not null
          group by product_id, variant_id) oi
    where not exists (select 1 from public.inventory i where i.product_id = oi.product_id and i.variant_id is not distinct from oi.variant_id)
    on conflict do nothing;

  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor, event_type, message)
    values(p_order_id, coalesce(p_actor::text,'system'), 'order_cancelled', 'Pedido cancelado desde administración; el inventario disponible fue restaurado cuando correspondía.');
  return jsonb_build_object('ok', true, 'already_cancelled', false, 'order_number', v_order_number);
end;
$$;
revoke all on function public.cancel_store_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_store_order(uuid,uuid) to service_role;
