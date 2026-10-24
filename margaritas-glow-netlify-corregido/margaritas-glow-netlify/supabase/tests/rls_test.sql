-- Test de humo para ejecutar después de aplicar la migración en Supabase.
-- Requiere pgTAP, disponible en proyectos Supabase; no inserta ni modifica datos.
create extension if not exists pgtap with schema extensions;
begin;
select plan(5);
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'products tiene RLS habilitado');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders tiene RLS habilitado');
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), 'customers tiene RLS habilitado');
select ok(not has_table_privilege('anon', 'public.orders', 'select'), 'anon no tiene permiso SELECT directo sobre orders');
select ok(not has_table_privilege('anon', 'public.customers', 'select'), 'anon no tiene permiso SELECT directo sobre customers');
select * from finish();
rollback;
