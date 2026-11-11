-- =====================================================================
-- Personal Shopper Miami → Chile — esquema de base de datos (Supabase)
-- Pegar completo en Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'client' check (role in ('client','shopper')),
  locker_code text unique,
  created_at  timestamptz not null default now()
);

create sequence if not exists public.locker_seq start 1001;

-- Crea el perfil y el número de casillero al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, locker_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'CL' || nextval('public.locker_seq')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿El usuario actual es la shopper?
create or replace function public.is_shopper()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'shopper');
$$;

-- ---------- Ajustes (una sola fila) ----------
create table if not exists public.settings (
  id                   int primary key default 1 check (id = 1),
  usd_clp              numeric not null default 1032.65,
  fl_tax_pct           numeric not null default 7,
  fee_pct              numeric not null default 25,
  min_fee_usd          numeric not null default 0,
  ship_usd_per_kg      numeric not null default 10,     -- transporte del courier por kg cobrable
  vol_divisor          numeric not null default 6000,   -- peso volumétrico = largo*ancho*alto(cm)/divisor
  min_charge_kg        numeric not null default 1,
  fixed_kg             numeric not null default 3,
  customs_fixed_usd    numeric not null default 2.2,    -- gastos fijos de aduana por envío
  insurance_pct        numeric not null default 0,
  cl_duty_pct          numeric not null default 6,
  cl_vat_pct           numeric not null default 19,
  locker_address       text not null default '[Dirección en Miami], Miami, FL [código postal]',
  payment_instructions text not null default 'Transferencia a: [banco, cuenta, RUT, correo]. Envía el comprobante por WhatsApp.',
  whatsapp             text not null default '',
  cashier_name         text not null default 'Cheryl',
  cashier_photo        text not null default '',
  bank_name            text not null default '',
  bank_account_type    text not null default 'Cuenta corriente',
  bank_account         text not null default '',
  bank_rut             text not null default '',
  bank_holder          text not null default '',
  bank_email           text not null default '',
  mall_name            text not null default 'Sawgrass Mills',
  store_photos         jsonb not null default '{}',   -- fachada de cada tienda virtual {"Carteras": url}
  mall_photos          jsonb not null default '[]',   -- fotos del pasillo para las transiciones
  live_store           text,
  live_until           timestamptz,
  updated_at           timestamptz not null default now()
);
alter table public.settings add column if not exists mall_name text not null default 'Sawgrass Mills';
alter table public.settings add column if not exists store_photos jsonb not null default '{}';
alter table public.settings add column if not exists fixed_kg numeric not null default 3;
alter table public.settings alter column fee_pct set default 25;
-- Comisión nueva 25 % (nov-2026): sube las que seguían en el 20 % anterior
update public.settings set fee_pct = 25 where fee_pct = 20;
alter table public.settings add column if not exists mall_photos jsonb not null default '[]';
alter table public.settings add column if not exists cashier_name text not null default 'Cheryl';
alter table public.settings add column if not exists cashier_photo text not null default '';
alter table public.settings add column if not exists bank_name text not null default '';
alter table public.settings add column if not exists bank_account_type text not null default 'Cuenta corriente';
alter table public.settings add column if not exists bank_account text not null default '';
alter table public.settings add column if not exists bank_rut text not null default '';
alter table public.settings add column if not exists bank_holder text not null default '';
alter table public.settings add column if not exists bank_email text not null default '';
alter table public.settings add column if not exists fx_auto boolean not null default true;
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- Ofertas ----------
create table if not exists public.offers (
  id           uuid primary key default gen_random_uuid(),
  shopper_id   uuid not null default auth.uid() references public.profiles(id),
  title        text not null,
  brand        text,
  category     text not null,
  product_type text,
  price_usd    numeric not null check (price_usd > 0),   -- precio final pagado en tienda
  tag_price_usd numeric,                                    -- precio de la etiqueta (si hubo descuento)
  discount_pct  numeric check (discount_pct is null or (discount_pct > 0 and discount_pct < 100)),
  weight_kg    numeric,
  box_l        numeric,
  box_w        numeric,
  box_h        numeric,
  store        text,
  photo_url    text,                                     -- foto principal (con etiqueta)
  photos       jsonb not null default '[]',              -- más fotos: [{url, caption}]
  size_w_cm    numeric,                                  -- medidas aprox. del producto
  size_h_cm    numeric,
  size_d_cm    numeric,
  colors       jsonb not null default '[]',              -- colores disponibles ["Negro","Café"]
  sizes        jsonb not null default '[]',              -- tallas disponibles ["S","M"]
  last_minute  boolean not null default false,           -- tienda "Último minuto"
  promo        text,                                     -- '2x1' = promoción 2×1
  status       text not null default 'active' check (status in ('active','gone')),
  expires_at   timestamptz not null default now() + interval '48 hours',
  created_at   timestamptz not null default now()
);
alter table public.offers add column if not exists tag_price_usd numeric;
alter table public.offers add column if not exists product_type text;
alter table public.offers add column if not exists photos jsonb not null default '[]';
alter table public.offers add column if not exists size_w_cm numeric;
alter table public.offers add column if not exists size_h_cm numeric;
alter table public.offers add column if not exists size_d_cm numeric;
alter table public.offers add column if not exists colors jsonb not null default '[]';
alter table public.offers add column if not exists sizes jsonb not null default '[]';
alter table public.offers add column if not exists last_minute boolean not null default false;
alter table public.offers add column if not exists promo text;
alter table public.offers add column if not exists discount_pct numeric;
alter table public.offers add column if not exists discount1_pct numeric;   -- descuento de la etiqueta (%)
alter table public.offers add column if not exists discount2_pct numeric;   -- descuento extra sobre el ya rebajado (%); discount_pct = total equivalente
alter table public.offers add column if not exists featured boolean not null default false; -- flyer destacado en la vitrina (máx. 4 por tienda, se controla en la app)
alter table public.offers add column if not exists vitrina_pos int;   -- orden del afiche en la vitrina (0 = primero); null = sin orden fijo
-- Catálogo Mujer / Hombre: 'unisex' aparece en ambos. Lencería y Carteras son siempre 'mujer'.
alter table public.offers add column if not exists gender text not null default 'unisex';
update public.offers set gender = 'mujer' where category in ('Lenceria','Carteras') and gender is distinct from 'mujer';
update public.offers set gender = 'unisex' where gender is null or gender not in ('mujer','hombre','unisex');
alter table public.offers drop constraint if exists offers_gender_check;
alter table public.offers add constraint offers_gender_check check (gender in ('mujer','hombre','unisex'));
alter table public.offers drop constraint if exists offers_gender_women_only;
alter table public.offers add constraint offers_gender_women_only check (category not in ('Lenceria','Carteras') or gender = 'mujer');
create or replace function public.offers_gender_default()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.category in ('Lenceria','Carteras') then new.gender := 'mujer'; end if;   -- se asigna sola: la app no la pregunta
  -- 10 tiendas: ropa de hombre va a la tienda 08 "Ropa Hombre" (categoría 'RopaHombre'), siempre de hombre
  if new.category = 'Ropa' and new.gender = 'hombre' then new.category := 'RopaHombre'; end if;
  if new.category = 'RopaHombre' then new.gender := 'hombre'; end if;
  if new.gender is null then new.gender := 'unisex'; end if;
  return new;
end $$;
drop trigger if exists offers_gender_default on public.offers;
create trigger offers_gender_default before insert or update of category, gender on public.offers
  for each row execute function public.offers_gender_default();
revoke execute on function public.offers_gender_default() from public, anon, authenticated;
create index if not exists offers_active_idx on public.offers (status, expires_at desc);
create index if not exists offers_gender_idx on public.offers (gender) where status = 'active';

-- ---------- Búsquedas por encargo ----------
create table if not exists public.searches (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category      text not null,
  brand         text,
  max_price_usd numeric,
  details       text,
  phone         text,                                     -- WhatsApp del cliente para avisarle
  status        text not null default 'pendiente' check (status in ('pendiente','encontrado','avisado','comprado','cerrado')),
  expires_at    timestamptz not null default now() + interval '30 days',
  created_at    timestamptz not null default now()
);

alter table public.searches add column if not exists phone text;

-- ---------- Encargos encontrados: "Lo encontré" → oferta para esa clienta → aviso por WhatsApp ----------
-- Estados: pendiente → encontrado (Cheryl publicó el producto) → avisado (tocó "Contactar") → comprado
-- (la clienta compró esa oferta; lo marca el trigger de orders) · cerrado (no lo encontró / ya no lo busca).
-- Migración idempotente: no borra datos; traduce los estados antiguos open/found/closed.
alter table public.searches add column if not exists size text;
alter table public.searches add column if not exists color text;
alter table public.searches add column if not exists offer_id uuid references public.offers(id) on delete set null;
alter table public.searches add column if not exists found_at timestamptz;
alter table public.searches add column if not exists notified_at timestamptz;
alter table public.searches add column if not exists purchased_at timestamptz;
alter table public.searches add column if not exists closed_at timestamptz;
alter table public.searches add column if not exists order_code text;
alter table public.searches drop constraint if exists searches_status_check;
update public.searches set status = case status when 'open' then 'pendiente' when 'found' then 'encontrado' when 'closed' then 'cerrado' else status end
 where status in ('open','found','closed');
alter table public.searches alter column status set default 'pendiente';
alter table public.searches add constraint searches_status_check check (status in ('pendiente','encontrado','avisado','comprado','cerrado'));
create index if not exists searches_offer_idx on public.searches (offer_id) where offer_id is not null;
create index if not exists searches_status_idx on public.searches (status, created_at desc);
-- La oferta sabe de qué encargo viene y, si es "solo para esta clienta", para quién está reservada
alter table public.offers add column if not exists request_id uuid references public.searches(id) on delete set null;
alter table public.offers add column if not exists reserved_for uuid references public.profiles(id) on delete set null;
create index if not exists offers_reserved_idx on public.offers (reserved_for) where reserved_for is not null;

-- ---------- Pedidos ----------
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  offer_id    uuid references public.offers(id) on delete set null,
  search_id   uuid references public.searches(id) on delete set null,
  description text not null,
  notes       text,
  order_code  text,                       -- N° de orden de compra (agrupa los productos de una compra)
  receipt_path text,                      -- foto del comprobante de transferencia (bucket privado receipts)
  price_usd   numeric,
  total_clp   numeric,
  status      text not null default 'pendiente_pago'
              check (status in ('pendiente_pago','pagado','comprado','en_bodega','enviado','entregado','cancelado')),
  created_at  timestamptz not null default now()
);

alter table public.orders add column if not exists order_code text;
alter table public.orders add column if not exists receipt_path text;

-- ---------- Casilla (paquetes recibidos en Miami) ----------
create table if not exists public.packages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  description  text not null,
  store        text,
  tracking     text,
  weight_kg    numeric,
  box_l        numeric,
  box_w        numeric,
  box_h        numeric,
  declared_usd numeric,
  photo_url    text,
  status       text not null default 'recibido'
               check (status in ('recibido','consolidar','pagado','enviado','entregado')),
  created_at   timestamptz not null default now()
);

-- ---------- Notificaciones ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  message    text not null,
  offer_id   uuid references public.offers(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Cruce automático: al publicar una oferta, avisa a quien la busca ----------
create or replace function public.match_offer_to_searches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- reservada para una clienta (encargo encontrado): solo ella recibe el aviso
  if new.reserved_for is not null then
    insert into public.notifications (user_id, message, offer_id)
    values (new.reserved_for, '¡' || coalesce((select cashier_name from public.settings where id = 1), 'Cheryl') || ' encontró tu encargo! ' || new.title, new.id);
    return new;
  end if;
  insert into public.notifications (user_id, message, offer_id)
  select s.client_id,
         '¡Encontramos algo para tu búsqueda! ' || new.title || ' a US$' || new.price_usd,
         new.id
  from public.searches s
  where s.status = 'pendiente'
    and s.id is distinct from new.request_id
    and s.expires_at > now()
    and (s.category = new.category or (s.category in ('Ropa','RopaHombre') and new.category in ('Ropa','RopaHombre')))   -- un encargo de "Ropa" cruza con Ropa Mujer y Ropa Hombre
    and (s.brand is null or s.brand = '' or coalesce(new.brand,'') ilike '%' || s.brand || '%'
         or new.title ilike '%' || s.brand || '%')
    and (s.max_price_usd is null or new.price_usd <= s.max_price_usd);
  return new;
end $$;

drop trigger if exists on_offer_created on public.offers;
create trigger on_offer_created
  after insert on public.offers
  for each row execute function public.match_offer_to_searches();

-- Cuántas búsquedas calzan con una oferta (para mostrárselo a la shopper)
create or replace function public.count_matches(p_offer uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where offer_id = p_offer;
$$;

-- Registrar un paquete de casilla por número de casillero
create or replace function public.register_package(
  p_locker text, p_description text, p_store text, p_tracking text,
  p_weight numeric, p_declared numeric, p_photo text,
  p_l numeric default null, p_w numeric default null, p_h numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_id uuid;
begin
  if not public.is_shopper() then raise exception 'Solo la shopper puede registrar paquetes'; end if;
  select id into v_client from public.profiles where upper(locker_code) = upper(trim(p_locker));
  if v_client is null then raise exception 'No existe el casillero %', p_locker; end if;
  insert into public.packages (client_id, description, store, tracking, weight_kg, box_l, box_w, box_h, declared_usd, photo_url)
  values (v_client, p_description, p_store, p_tracking, p_weight, p_l, p_w, p_h, p_declared, p_photo)
  returning id into v_id;
  insert into public.notifications (user_id, message)
  values (v_client, 'Llegó un paquete a tu casilla: ' || p_description);
  return v_id;
end $$;

-- ---------- Compras compartidas (2×1 / pagar a medias) ----------
create table if not exists public.purchase_groups (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null default 'split' check (kind in ('split','2x1')),
  items       jsonb not null default '[]',
  total_clp   numeric not null default 0,
  host_name   text,
  host_phone  text,
  members     jsonb not null default '[]',   -- [{user_id, name, phone, joined_at}]
  created_at  timestamptz not null default now()
);

-- Unirse a una compra compartida con el link
create or replace function public.join_group(p_id uuid, p_name text, p_phone text)
returns public.purchase_groups language plpgsql security definer set search_path = public as $$
declare g public.purchase_groups;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into g from public.purchase_groups where id = p_id for update;
  if g.id is null then raise exception 'Esta compra compartida ya no existe'; end if;
  if g.host_id <> auth.uid() and not exists (select 1 from jsonb_array_elements(g.members) m where m->>'user_id' = auth.uid()::text) then
    if jsonb_array_length(g.members) >= 3 then raise exception 'Esta compra ya está completa'; end if;
    update public.purchase_groups set members = members || jsonb_build_array(jsonb_build_object('user_id', auth.uid(), 'name', p_name, 'phone', p_phone, 'joined_at', now()))
      where id = p_id returning * into g;
  end if;
  return g;
end $$;

-- =====================================================================
-- Seguridad (Row Level Security)
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.settings      enable row level security;
alter table public.offers        enable row level security;
alter table public.searches      enable row level security;
alter table public.orders        enable row level security;
alter table public.packages      enable row level security;
alter table public.notifications enable row level security;
alter table public.purchase_groups enable row level security;

-- Perfiles: cada uno ve el suyo; la shopper ve todos. Solo se pueden editar nombre y teléfono.
drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles for select using (id = auth.uid() or public.is_shopper());
drop policy if exists "editar perfil propio" on public.profiles;
create policy "editar perfil propio" on public.profiles for update using (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- Ajustes: todos leen, solo la shopper edita
drop policy if exists "leer ajustes" on public.settings;
create policy "leer ajustes" on public.settings for select using (true);
drop policy if exists "editar ajustes" on public.settings;
create policy "editar ajustes" on public.settings for update using (public.is_shopper());

-- Ofertas: el catálogo es público; solo la shopper publica y edita
drop policy if exists "ver ofertas" on public.offers;
-- Ofertas reservadas (encargo encontrado, "solo para esta clienta"): no salen en ninguna lista pública.
-- Las ve su clienta (reserved_for) y la shopper; quien tenga el link #o-<uuid> la abre con get_offer().
create policy "ver ofertas" on public.offers for select using (reserved_for is null or reserved_for = auth.uid() or public.is_shopper());
drop policy if exists "publicar ofertas" on public.offers;
create policy "publicar ofertas" on public.offers for insert with check (public.is_shopper());
drop policy if exists "editar ofertas" on public.offers;
create policy "editar ofertas" on public.offers for update using (public.is_shopper());
drop policy if exists "borrar ofertas" on public.offers;
create policy "borrar ofertas" on public.offers for delete using (public.is_shopper());

-- Búsquedas: el cliente maneja las suyas; la shopper ve y actualiza todas
drop policy if exists "ver busquedas" on public.searches;
create policy "ver busquedas" on public.searches for select using (client_id = auth.uid() or public.is_shopper());
drop policy if exists "crear busqueda" on public.searches;
create policy "crear busqueda" on public.searches for insert with check (client_id = auth.uid());
drop policy if exists "editar busqueda" on public.searches;
create policy "editar busqueda" on public.searches for update using (client_id = auth.uid() or public.is_shopper());

-- Pedidos: el cliente crea y ve los suyos; la shopper ve y cambia el estado
drop policy if exists "ver pedidos" on public.orders;
create policy "ver pedidos" on public.orders for select using (client_id = auth.uid() or public.is_shopper());
drop policy if exists "crear pedido" on public.orders;
create policy "crear pedido" on public.orders for insert with check (client_id = auth.uid() and status = 'pendiente_pago');
drop policy if exists "editar pedido" on public.orders;
create policy "editar pedido" on public.orders for update using (public.is_shopper());

-- Casilla: el cliente ve sus paquetes y puede pedir consolidar; la shopper maneja todo
drop policy if exists "ver paquetes" on public.packages;
create policy "ver paquetes" on public.packages for select using (client_id = auth.uid() or public.is_shopper());
drop policy if exists "editar paquetes" on public.packages;
create policy "editar paquetes" on public.packages for update using (public.is_shopper() or client_id = auth.uid())
  with check (public.is_shopper() or status in ('recibido','consolidar'));

-- Notificaciones: cada uno ve y marca como leídas las suyas
drop policy if exists "ver notificaciones" on public.notifications;
create policy "ver notificaciones" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "leer notificaciones" on public.notifications;
create policy "leer notificaciones" on public.notifications for update using (user_id = auth.uid());

-- Compras compartidas: quien tiene el link (id imposible de adivinar) la puede ver
drop policy if exists "ver compra compartida" on public.purchase_groups;
create policy "ver compra compartida" on public.purchase_groups for select to authenticated using (true);
drop policy if exists "crear compra compartida" on public.purchase_groups;
create policy "crear compra compartida" on public.purchase_groups for insert to authenticated with check (host_id = auth.uid());
grant execute on function public.join_group(uuid, text, text) to authenticated;

-- La clienta adjunta la foto de su transferencia a su orden
create or replace function public.attach_receipt(p_code text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  -- el comprobante debe estar en la carpeta de quien lo adjunta (o la shopper)
  if not public.is_shopper() and split_part(coalesce(p_path, ''), '/', 1) <> auth.uid()::text then
    raise exception 'Comprobante inválido';
  end if;
  update public.orders set receipt_path = p_path
   where order_code = p_code and (client_id = auth.uid() or public.is_shopper());
  get diagnostics n = row_count;
  -- sin orden propia con ese código no se avisa (evita spam de notificaciones a la shopper)
  if n = 0 then raise exception 'No existe la orden %', p_code; end if;
  insert into public.notifications (user_id, message)
  select id, 'Llegó un comprobante de transferencia para la orden ' || p_code from public.profiles where role = 'shopper';
end $$;
grant execute on function public.attach_receipt(text, text) to authenticated;

-- Avisos para la shopper: orden nueva (una vez por código) y encargo nuevo
create or replace function public.notify_shopper_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_code is null or not exists (select 1 from public.orders o where o.order_code = new.order_code and o.id <> new.id) then
    insert into public.notifications (user_id, message)
    select p.id, 'Nueva orden ' || coalesce(new.order_code, '') || ' de ' || coalesce((select full_name from public.profiles where id = new.client_id), 'una clienta')
      from public.profiles p where p.role = 'shopper' and p.id <> new.client_id;
  end if;
  return new;
end $$;
drop trigger if exists on_order_created on public.orders;
create trigger on_order_created after insert on public.orders for each row execute function public.notify_shopper_new_order();

create or replace function public.notify_shopper_new_search()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, message)
  select p.id, 'Nuevo encargo de ' || coalesce((select full_name from public.profiles where id = new.client_id), 'una clienta') || ': ' || new.category
         || coalesce(' · ' || nullif(new.brand, ''), '') || coalesce(' hasta US$' || new.max_price_usd, '')
    from public.profiles p where p.role = 'shopper' and p.id <> new.client_id;
  return new;
end $$;
drop trigger if exists on_search_created on public.searches;
create trigger on_search_created after insert on public.searches for each row execute function public.notify_shopper_new_search();
revoke execute on function public.notify_shopper_new_order() from public, anon, authenticated;
revoke execute on function public.notify_shopper_new_search() from public, anon, authenticated;
revoke execute on function public.attach_receipt(text, text) from public, anon;
revoke execute on function public.join_group(uuid, text, text) from public, anon;
revoke execute on function public.register_package(text,text,text,text,numeric,numeric,text,numeric,numeric,numeric) from public, anon;

grant execute on function public.count_matches(uuid) to authenticated;
grant execute on function public.register_package(text,text,text,text,numeric,numeric,text,numeric,numeric,numeric) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.match_offer_to_searches() from public, anon, authenticated;

-- =====================================================================
-- Fotos (Storage): lectura pública, solo la shopper sube
-- =====================================================================
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Comprobantes de transferencia: bucket privado; cada clienta sube a su carpeta y solo ella y la shopper los ven
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;
drop policy if exists "clienta sube comprobante" on storage.objects;
create policy "clienta sube comprobante" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ver comprobantes" on storage.objects;
create policy "ver comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_shopper()));

drop policy if exists "shopper sube fotos" on storage.objects;
create policy "shopper sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_shopper());

-- =====================================================================
-- Clientas: ficha con N° corto y correlativo (MSM-00001), datos de envío y facturación
-- (clientes.js). Se crea al confirmar la primera compra en la caja; se reutiliza si ya
-- existe para la cuenta, o si se reconoce por teléfono o mail una ficha sin cuenta.
-- Las notas privadas de la shopper van en una tabla aparte que la clienta no puede leer.
-- Idempotente: se puede volver a correr.
-- =====================================================================
create sequence if not exists public.customer_code_seq start 1;

-- RUT chileno: dígito verificador módulo 11 (acepta con o sin puntos/guion, K mayúscula o minúscula)
create or replace function public.rut_valid(p text)
returns boolean language plpgsql immutable set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p, ''), '[^0-9kK]', '', 'g')); body text; dv text; s int := 0; m int := 2; r int; i int;
begin
  if length(c) < 8 or length(c) > 9 then return false; end if;
  body := left(c, length(c) - 1); dv := right(c, 1);
  if body !~ '^[0-9]+$' then return false; end if;
  for i in reverse length(body)..1 loop
    s := s + substr(body, i, 1)::int * m; m := case when m = 7 then 2 else m + 1 end;
  end loop;
  r := 11 - (s % 11);
  return dv = case r when 11 then '0' when 10 then 'K' else r::text end;
end $$;

create table if not exists public.customers (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,                 -- MSM-00042 (lo pone el trigger, desde customer_code_seq)
  user_id              uuid unique references public.profiles(id) on delete set null,   -- cuenta de la clienta (null = anotada por la shopper)
  full_name            text not null default '',
  email                text,
  phone                text,                                  -- '+56 9 1234 5678'
  country              text not null default 'Chile',
  region               text,
  city                 text,                                  -- comuna o ciudad
  address              text,                                  -- calle y número
  address2             text,                                  -- depto, casa u oficina
  needs_invoice        boolean not null default false,        -- "Necesito factura por el servicio"
  billing_name         text,                                  -- razón social o nombre
  billing_rut          text check (billing_rut is null or billing_rut = '' or public.rut_valid(billing_rut)),
  billing_giro         text,
  billing_same_address boolean not null default true,         -- dirección de facturación = la de envío
  billing_address      text,
  billing_city         text,
  billing_region       text,
  billing_email        text,
  billing_phone        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_phone_idx on public.customers (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9));

-- N° MSM correlativo al crear; el N° y la cuenta asociada no se pueden cambiar después
-- (salvo al reconocer una ficha sin cuenta dentro de upsert_my_customer)
create or replace function public.customers_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if tg_op = 'INSERT' then
    n := nextval('public.customer_code_seq');
    new.code := 'MSM-' || case when n < 100000 then lpad(n::text, 5, '0') else n::text end;
    if auth.uid() is not null and not public.is_shopper() and coalesce(current_setting('app.customer_claim', true), '') <> '1' then new.user_id := auth.uid(); end if;
  else
    new.code := old.code;
    new.created_at := old.created_at;
    if auth.uid() is not null and coalesce(current_setting('app.customer_claim', true), '') <> '1' and not public.is_shopper() then new.user_id := old.user_id; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists customers_guard on public.customers;
create trigger customers_guard before insert or update on public.customers for each row execute function public.customers_guard();
revoke execute on function public.customers_guard() from public, anon, authenticated;

-- Notas privadas de la shopper (tabla aparte: la clienta no tiene ninguna política que le permita leerlas)
create table if not exists public.customer_notes (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  notes       text not null default '',
  updated_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- RUT personal de la clienta (lo pide la aduana para entregar en Chile). Validación en upsert_my_customer.
alter table public.customers add column if not exists rut text;

-- La clienta crea o actualiza SU ficha (la caja y "Mi cuenta" usan solo esto).
-- 1) su propia ficha; 2) una ficha sin cuenta con el mismo teléfono (9 últimos dígitos) o mail; 3) una nueva.
create or replace function public.upsert_my_customer(p jsonb)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c public.customers; v_uid uuid := auth.uid(); v_phone text; v_email text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if coalesce(trim(p->>'full_name'), '') = '' then raise exception 'Falta el nombre'; end if;
  if coalesce(p->>'billing_rut', '') <> '' and not public.rut_valid(p->>'billing_rut') then raise exception 'El RUT de facturación no es válido'; end if;
  if coalesce(nullif(p->>'country', ''), 'Chile') = 'Chile' and coalesce(p->>'rut', '') <> '' and not public.rut_valid(p->>'rut') then raise exception 'El RUT no es válido'; end if;
  select * into c from public.customers where user_id = v_uid for update;
  if c.id is null then
    v_phone := right(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), 9);
    v_email := lower(trim(coalesce(p->>'email', '')));
    select * into c from public.customers
     where user_id is null
       and ((length(v_phone) = 9 and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = v_phone)
            or (v_email <> '' and lower(email) = v_email))
     order by created_at limit 1 for update;
    perform set_config('app.customer_claim', '1', true);
    if c.id is not null then
      update public.customers set user_id = v_uid where id = c.id;
    else
      insert into public.customers (user_id, full_name) values (v_uid, trim(p->>'full_name')) returning * into c;
    end if;
    perform set_config('app.customer_claim', '', true);
  end if;
  update public.customers set
    full_name            = trim(p->>'full_name'),
    rut                  = case when p ? 'rut' then p->>'rut' else rut end,
    email                = case when p ? 'email' then lower(trim(p->>'email')) else email end,
    phone                = case when p ? 'phone' then p->>'phone' else phone end,
    country              = coalesce(nullif(p->>'country', ''), country),
    region               = case when p ? 'region' then p->>'region' else region end,
    city                 = case when p ? 'city' then p->>'city' else city end,
    address              = case when p ? 'address' then p->>'address' else address end,
    address2             = case when p ? 'address2' then p->>'address2' else address2 end,
    needs_invoice        = case when p ? 'needs_invoice' then coalesce((p->>'needs_invoice')::boolean, false) else needs_invoice end,
    billing_name         = case when p ? 'billing_name' then p->>'billing_name' else billing_name end,
    billing_rut          = case when p ? 'billing_rut' then p->>'billing_rut' else billing_rut end,
    billing_giro         = case when p ? 'billing_giro' then p->>'billing_giro' else billing_giro end,
    billing_same_address = case when p ? 'billing_same_address' then coalesce((p->>'billing_same_address')::boolean, true) else billing_same_address end,
    billing_address      = case when p ? 'billing_address' then p->>'billing_address' else billing_address end,
    billing_city         = case when p ? 'billing_city' then p->>'billing_city' else billing_city end,
    billing_region       = case when p ? 'billing_region' then p->>'billing_region' else billing_region end,
    billing_email        = case when p ? 'billing_email' then p->>'billing_email' else billing_email end,
    billing_phone        = case when p ? 'billing_phone' then p->>'billing_phone' else billing_phone end
  where id = c.id returning * into c;
  return c;
end $$;
revoke execute on function public.upsert_my_customer(jsonb) from public, anon;
grant execute on function public.upsert_my_customer(jsonb) to authenticated;

-- Pedidos: a qué clienta pertenecen + copia de los datos de envío / facturación de ese momento
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists customer_code text;
alter table public.orders add column if not exists ship_to jsonb;    -- {code, full_name, email, phone, country, region, city, address, address2}
alter table public.orders add column if not exists bill_to jsonb;    -- null = sin factura; {name, rut, giro, address, city, region, email, phone}
create index if not exists orders_customer_idx on public.orders (customer_id);
-- el N° de la orden siempre es el real de la ficha (no el que mande el teléfono)
create or replace function public.orders_customer_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null then new.customer_code := (select code from public.customers where id = new.customer_id); end if;
  return new;
end $$;
drop trigger if exists orders_customer_code on public.orders;
create trigger orders_customer_code before insert or update of customer_id on public.orders for each row execute function public.orders_customer_code();
revoke execute on function public.orders_customer_code() from public, anon, authenticated;
-- La clienta solo puede asociar su orden a SU ficha
drop policy if exists "crear pedido" on public.orders;
create policy "crear pedido" on public.orders for insert with check (
  client_id = auth.uid() and status = 'pendiente_pago'
  and (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())));

-- Ventas manuales (finanzas.js), si existe la tabla: también se pueden asociar a una clienta
alter table if exists public.manual_sales add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Clientas que ya tenían pedidos antes de esta versión: ficha con lo que se sabe + enlace de pedidos
insert into public.customers (user_id, full_name, phone)
select p.id, coalesce(p.full_name, ''), p.phone from public.profiles p
 where p.role = 'client' and exists (select 1 from public.orders o where o.client_id = p.id)
   and not exists (select 1 from public.customers c where c.user_id = p.id);
update public.orders o set customer_id = c.id from public.customers c
 where o.customer_id is null and c.user_id = o.client_id;

-- Seguridad
alter table public.customers      enable row level security;
alter table public.customer_notes enable row level security;
drop policy if exists "ver ficha" on public.customers;
create policy "ver ficha" on public.customers for select using (user_id = auth.uid() or public.is_shopper());
drop policy if exists "crear ficha" on public.customers;
create policy "crear ficha" on public.customers for insert with check (public.is_shopper());   -- la clienta crea la suya con upsert_my_customer
drop policy if exists "editar ficha" on public.customers;
create policy "editar ficha" on public.customers for update using (user_id = auth.uid() or public.is_shopper())
  with check (user_id = auth.uid() or public.is_shopper());
drop policy if exists "borrar ficha" on public.customers;
create policy "borrar ficha" on public.customers for delete using (public.is_shopper());
drop policy if exists "notas de la shopper" on public.customer_notes;
create policy "notas de la shopper" on public.customer_notes for all using (public.is_shopper()) with check (public.is_shopper());
revoke all on public.customer_notes from anon;

-- =====================================================================
-- Encargos encontrados: lectura por link y cierre al comprar
-- =====================================================================
-- Lectura por id: get_offer(uuid) devuelve la oferta aunque esté reservada. Decisión: el uuid (122 bits
-- aleatorios) funciona como "link secreto", igual que la compra compartida #g-: quien recibió el link
-- puede verla (p. ej. la clienta lo reenvía a su hermana para que opine) pero nadie puede listarlas ni
-- adivinarlas. Es lo simple y aceptable aquí; si alguna vez se quisiera estricto, bastaría con agregar
-- "and (o.reserved_for is null or o.reserved_for = auth.uid() or public.is_shopper())" al where.
create or replace function public.get_offer(p_id uuid)
returns setof public.offers language sql stable security definer set search_path = public as $$
  select o.* from public.offers o where o.id = p_id;
$$;
revoke execute on function public.get_offer(uuid) from public, anon;
grant execute on function public.get_offer(uuid) to authenticated;

-- Si la clienta compra la oferta que le encontraron, su encargo pasa a "comprado" (y la orden queda ligada)
create or replace function public.orders_close_search()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_search uuid;
begin
  if new.offer_id is null then return new; end if;
  select s.id into v_search from public.searches s
   where s.offer_id = new.offer_id and s.client_id = new.client_id and s.status in ('encontrado','avisado')
   order by s.created_at limit 1;
  if v_search is null then return new; end if;
  update public.searches s set status = 'comprado', purchased_at = now(), order_code = new.order_code
   where s.offer_id = new.offer_id and s.client_id = new.client_id and s.status in ('encontrado','avisado');
  if new.search_id is null then new.search_id := v_search; end if;
  return new;
end $$;
drop trigger if exists orders_close_search on public.orders;
create trigger orders_close_search before insert on public.orders for each row execute function public.orders_close_search();
revoke execute on function public.orders_close_search() from public, anon, authenticated;

-- Género de la clienta (opcional): solo para escribirle "interesada / interesado"; vacío = forma neutra
alter table public.customers add column if not exists gender text;
alter table public.customers drop constraint if exists customers_gender_check;
alter table public.customers add constraint customers_gender_check check (gender is null or gender in ('mujer','hombre'));

-- =====================================================================
-- Afiche grande de cada tienda en el mall 3D ("campaña", campanas.js). Una fila por tienda
-- (cat = clave de SHOPS en app.js: 'Carteras', 'Zapatos', …, '__ultimo'). Cambia día a día.
-- Sin fila, la app muestra la oferta destacada con mayor descuento ("Hasta −X%").
-- img_url null + title = la foto automática con el texto de Cheryl.
-- Las fotos van al bucket público "photos" (carpeta campaigns/), igual que las de las ofertas.
-- Todos leen (también sin sesión, para la caminata); solo la shopper escribe. Idempotente.
-- =====================================================================
create table if not exists public.store_campaigns (
  cat        text primary key check (length(cat) between 1 and 40),
  img_url    text,
  title      text check (title is null or length(title) <= 80),
  offer_id   uuid references public.offers(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.store_campaigns enable row level security;
drop policy if exists "leer campañas" on public.store_campaigns;
create policy "leer campañas" on public.store_campaigns for select using (true);
drop policy if exists "crear campañas" on public.store_campaigns;
create policy "crear campañas" on public.store_campaigns for insert with check (public.is_shopper());
drop policy if exists "editar campañas" on public.store_campaigns;
create policy "editar campañas" on public.store_campaigns for update using (public.is_shopper()) with check (public.is_shopper());
drop policy if exists "borrar campañas" on public.store_campaigns;
create policy "borrar campañas" on public.store_campaigns for delete using (public.is_shopper());
grant select on public.store_campaigns to anon, authenticated;
grant insert, update, delete on public.store_campaigns to authenticated;

-- ---------------------------------------------------------------------
-- "Afiches de la vitrina": 4 pantallas por tienda (campanas.js). Una fila por (tienda, pantalla) con FOTO
-- subida; slot = 0..3 en el orden en que se ven en el vidrio (2×2). Las pantallas con OFERTA no van aquí:
-- son offers.featured = true con offers.vitrina_pos = slot. Sin fila ni oferta = automático (mayor descuento).
-- Migración idempotente: las filas viejas (un afiche por tienda) quedan como pantalla 1 (slot 0).
-- ---------------------------------------------------------------------
alter table public.store_campaigns add column if not exists slot smallint not null default 0;
alter table public.store_campaigns drop constraint if exists store_campaigns_slot_check;
alter table public.store_campaigns add constraint store_campaigns_slot_check check (slot between 0 and 3);
do $$
declare pk_cols int; pk_name text;
begin
  select array_length(conkey, 1), conname into pk_cols, pk_name from pg_constraint
    where conrelid = 'public.store_campaigns'::regclass and contype = 'p';
  if pk_cols = 1 then                       -- PK vieja (solo cat) → (cat, slot)
    execute format('alter table public.store_campaigns drop constraint %I', pk_name);
    pk_cols := null;
  end if;
  if pk_cols is null then
    alter table public.store_campaigns add constraint store_campaigns_pkey primary key (cat, slot);
  end if;
end $$;

-- =====================================================================
-- 10 tiendas 1 a 1 con el mall 3D (tiendas.js y mall/v2/tiendas.json). Idempotente.
--   01 Carteras · 02 Zapatos · 03 Deportes (Ropa Deportiva) · 04 Relojes (Relojes y Joyas) · 05 Lenceria
--   06 Invierno (Ropa Invierno) · 07 Ropa (Ropa Mujer) · 08 RopaHombre (Ropa Hombre, nueva)
--   09 __ultimo (Ofertas: último minuto) · 10 Otros (Outlet)
-- Migración: las ofertas de "Ropa" de hombre pasan a 'RopaHombre'; mujer y unisex quedan en 'Ropa'.
-- =====================================================================
update public.offers set category = 'RopaHombre' where category = 'Ropa' and gender = 'hombre';
update public.offers set gender = 'hombre' where category = 'RopaHombre' and gender is distinct from 'hombre';
alter table public.offers drop constraint if exists offers_gender_men_only;
alter table public.offers add constraint offers_gender_men_only check (category <> 'RopaHombre' or gender = 'hombre');
-- categorías válidas de producto (not valid: no revisa filas antiguas, sí las nuevas y las que se editen)
alter table public.offers drop constraint if exists offers_category_check;
alter table public.offers add constraint offers_category_check check (category in
  ('Carteras','Zapatos','Relojes','Perfumes','Ropa','RopaHombre','Lentes','Joyas','Maquillaje','Juguetes','Hogar','Electrónica','Deportes','Lenceria','Invierno','Otros')) not valid;
-- afiche grande de "Ropa" que apuntaba a una oferta que ahora es de Ropa Hombre → pasa a 'RopaHombre' (si no tenía uno)
update public.store_campaigns c set cat = 'RopaHombre'
  where c.cat = 'Ropa' and not exists (select 1 from public.store_campaigns x where x.cat = 'RopaHombre')
    and exists (select 1 from public.offers o where o.id = c.offer_id and o.category = 'RopaHombre');
-- claves de tienda válidas para los afiches (las 10 de SHOPS)
alter table public.store_campaigns drop constraint if exists store_campaigns_cat_shop_check;
alter table public.store_campaigns add constraint store_campaigns_cat_shop_check check (cat in
  ('Carteras','Zapatos','Deportes','Relojes','Lenceria','Invierno','Ropa','RopaHombre','__ultimo','Otros')) not valid;

-- =====================================================================
-- DESPUÉS de que tu amiga cree su cuenta en la app, conviértela en shopper:
--   update public.profiles set role = 'shopper'
--   where id = (select id from auth.users where email = 'CORREO-DE-ELLA@ejemplo.com');
-- =====================================================================

-- Datos para transferencia (solo si aún están vacíos; Cheryl puede cambiarlos en Ajustes → Caja)
update public.settings set bank_name = 'Banco Falabella', bank_account_type = 'Cuenta corriente', bank_account = '1-999-121238-5',
  bank_rut = '13.892.047-K', bank_holder = 'Jorge Portugueiz', bank_email = 'castiblanco.cheryl@gmail.com'
where coalesce(bank_name, '') = '';

-- WhatsApp de Cheryl (contacto, pedidos y compras); solo si está vacío
update public.settings set whatsapp = '+56 9 7687 8239' where coalesce(whatsapp, '') = '';

-- =====================================================================
-- Cuentas de clienta (cuentas.js): correo + contraseña con Supabase Auth
-- =====================================================================
-- Sin sesión, la clienta recorre el mall como invitada (lee ajustes, ofertas y campañas);
-- la cuenta se pide al tocar "Comprar". Las políticas de lectura ya usan "using (true)" o
-- "reserved_for is null": aquí solo se asegura el permiso de lectura para anon.
grant select on public.settings, public.offers to anon;

-- Al registrarse (auth.signUp con options.data.full_name) se crea su perfil (casillero CLxxxx)
-- y su ficha de clienta (customers, N° MSM-xxxxx) con el MISMO correo de la cuenta.
-- Si Cheryl ya la tenía anotada (ficha sin cuenta con ese correo), se le asocia esa ficha.
-- Reemplaza la versión de arriba (idempotente). Un error en la ficha nunca impide crear la cuenta:
-- upsert_my_customer la crea igual en la primera compra.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(new.email, ''))); v_name text := trim(coalesce(new.raw_user_meta_data->>'full_name', '')); v_id uuid;
begin
  insert into public.profiles (id, full_name, phone, locker_code)
  values (new.id, v_name, coalesce(new.raw_user_meta_data->>'phone', ''), 'CL' || nextval('public.locker_seq'))
  on conflict (id) do nothing;
  begin
    perform set_config('app.customer_claim', '1', true);
    if not exists (select 1 from public.customers where user_id = new.id) then
      select id into v_id from public.customers
       where user_id is null and v_email <> '' and lower(email) = v_email
       order by created_at limit 1 for update;
      if v_id is not null then
        update public.customers set user_id = new.id, email = v_email,
               full_name = case when coalesce(full_name, '') = '' then v_name else full_name end
         where id = v_id;
      else
        insert into public.customers (user_id, full_name, email, country) values (new.id, v_name, nullif(v_email, ''), 'Chile');
      end if;
    end if;
    perform set_config('app.customer_claim', '', true);
  exception when others then
    perform set_config('app.customer_claim', '', true);
    raise warning 'handle_new_user: no se pudo crear la ficha de %: %', v_email, sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Fichas de cuentas que ya existían antes de este cambio (una vez, idempotente)
insert into public.customers (user_id, full_name, email, country)
select u.id, coalesce(p.full_name, ''), lower(u.email), 'Chile'
  from auth.users u join public.profiles p on p.id = u.id
 where p.role = 'client' and not exists (select 1 from public.customers c where c.user_id = u.id)
on conflict do nothing;

-- =====================================================================
-- Pedido → transferencia → ORDEN DE COMPRA → envío (ordenes.js). Idempotente.
--  1. La clienta hace el pedido: status 'pendiente_pago' (Pendiente de transferencia) y la boleta
--     congelada en order_snapshot (primera fila del pedido).
--  2. Comprobante de transferencia (bucket privado "receipts"), subido por la clienta o por Cheryl:
--     attach_receipt guarda quién (receipt_by) y cuándo (receipt_at) y pasa a 'comprobante_recibido'.
--  3. Solo la shopper aprueba, y SOLO si el pedido tiene comprobante (approve_order): N° OC-00001
--     correlativo (secuencia oc_seq), paid_at, paid_clp y status 'pagado' (Pagado - OC emitida).
--  4. register_shipment: courier, N° de seguimiento, fecha, peso, foto de la guía, nota → 'enviado'.
--  5. mark_delivered → 'entregado' con delivered_at.
-- El trigger orders_payment_guard impide saltarse estos pasos con un update directo.
-- =====================================================================
alter table public.orders add column if not exists order_snapshot jsonb;      -- boleta: productos, desglose, totales y datos de la clienta
alter table public.orders add column if not exists receipt_by text;           -- 'clienta' | 'cheryl'
alter table public.orders add column if not exists receipt_at timestamptz;
alter table public.orders add column if not exists oc_number text;            -- OC-00001
alter table public.orders add column if not exists paid_at timestamptz;       -- fecha de aprobación del pago
alter table public.orders add column if not exists paid_clp numeric;          -- monto confirmado por Cheryl
alter table public.orders add column if not exists shipment jsonb;            -- {courier, tracking, date, kg, label, note, at, by}
alter table public.orders add column if not exists delivered_at timestamptz;
-- Link de descarga de los PDF que se mandan por WhatsApp (no el archivo): token no adivinable + URL pública
-- en Storage (bucket "photos", carpeta docs/{pedido}-{token}.pdf). Solo la shopper los escribe (set_doc_url).
alter table public.orders add column if not exists oc_doc_token text;
alter table public.orders add column if not exists oc_pdf_url text;
alter table public.orders add column if not exists dispatch_doc_token text;
alter table public.orders add column if not exists dispatch_pdf_url text;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendiente_pago','comprobante_recibido','pagado','comprado','en_bodega','enviado','entregado','cancelado'));
alter table public.orders drop constraint if exists orders_receipt_by_check;
alter table public.orders add constraint orders_receipt_by_check check (receipt_by is null or receipt_by in ('clienta','cheryl'));
create index if not exists orders_oc_idx on public.orders (oc_number) where oc_number is not null;
create index if not exists orders_code_idx on public.orders (order_code);
create sequence if not exists public.oc_seq;

-- Guía de envío y pasos del despacho (Ajustes de Cheryl): {courier, courier_wa, courier_phone, courier_email,
-- track_url, eta, mode, pickup, pickup_hours, doc, customs, steps[5]}. Vacío = textos de ejemplo de la app.
alter table public.settings add column if not exists dispatch jsonb not null default '{}';

-- Nadie cambia a mano el comprobante, la OC, el pago ni el envío: solo las funciones de abajo
-- (que marcan app.oc_rpc = '1' dentro de su transacción).
create or replace function public.orders_payment_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.oc_rpc', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.receipt_path := null; new.receipt_by := null; new.receipt_at := null;
    new.oc_number := null; new.paid_at := null; new.paid_clp := null; new.shipment := null; new.delivered_at := null;
    new.oc_doc_token := null; new.oc_pdf_url := null; new.dispatch_doc_token := null; new.dispatch_pdf_url := null;
  else
    new.oc_doc_token := old.oc_doc_token; new.oc_pdf_url := old.oc_pdf_url; new.dispatch_doc_token := old.dispatch_doc_token; new.dispatch_pdf_url := old.dispatch_pdf_url;
    new.receipt_path := old.receipt_path; new.receipt_by := old.receipt_by; new.receipt_at := old.receipt_at;
    new.oc_number := old.oc_number; new.paid_at := old.paid_at; new.paid_clp := old.paid_clp;
    new.shipment := old.shipment; new.delivered_at := old.delivered_at;
    -- pedidos nuevos: no se pasa a "pagado" o más allá sin orden de compra (aprobación con comprobante)
    if new.status in ('pagado','comprado','en_bodega','enviado','entregado') and new.oc_number is null
       and old.status in ('pendiente_pago','comprobante_recibido') then
      raise exception 'Primero aprueba el pago con el comprobante de transferencia (orden de compra)';
    end if;
    if new.status in ('enviado','entregado') and new.oc_number is not null and new.shipment is null then
      raise exception 'Primero registra el envío (courier y número de seguimiento)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_payment_guard on public.orders;
create trigger orders_payment_guard before insert or update on public.orders for each row execute function public.orders_payment_guard();
revoke execute on function public.orders_payment_guard() from public, anon, authenticated;

-- Comprobante de transferencia (reemplaza la versión de arriba): quién lo subió y cuándo; el pedido pasa a revisión
create or replace function public.attach_receipt(p_code text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare n int; v_shop boolean := public.is_shopper();
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if not v_shop and split_part(coalesce(p_path, ''), '/', 1) <> auth.uid()::text then raise exception 'Comprobante inválido'; end if;
  perform set_config('app.oc_rpc', '1', true);
  update public.orders set receipt_path = p_path, receipt_by = case when v_shop then 'cheryl' else 'clienta' end, receipt_at = now(),
         status = case when status = 'pendiente_pago' then 'comprobante_recibido' else status end
   where order_code = p_code and (client_id = auth.uid() or v_shop);
  get diagnostics n = row_count;
  perform set_config('app.oc_rpc', '', true);
  if n = 0 then raise exception 'No existe la orden %', p_code; end if;
  if not v_shop then
    insert into public.notifications (user_id, message)
    select id, 'Llegó un comprobante de transferencia para la orden ' || p_code from public.profiles where role = 'shopper';
  end if;
end $$;
revoke execute on function public.attach_receipt(text, text) from public, anon;
grant execute on function public.attach_receipt(text, text) to authenticated;

-- Aprobar pago y generar orden de compra: solo la shopper y solo con comprobante en la app
drop function if exists public.approve_order(text, numeric);
create or replace function public.approve_order(p_code text, p_amount numeric)
returns table (oc_number text, paid_at timestamptz, oc_doc_token text) language plpgsql security definer set search_path = public as $$
declare v_oc text; v_at timestamptz; v_client uuid; v_tok text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_shopper() then raise exception 'Solo la shopper puede aprobar pagos'; end if;
  select o.oc_number, o.paid_at, o.oc_doc_token into v_oc, v_at, v_tok from public.orders o where o.order_code = p_code and o.oc_number is not null limit 1;
  if v_oc is not null then return query select v_oc, v_at, v_tok; return; end if;
  v_tok := replace(gen_random_uuid()::text, '-', '');
  if not exists (select 1 from public.orders o where o.order_code = p_code and o.status <> 'cancelado') then raise exception 'No existe el pedido %', p_code; end if;
  if not exists (select 1 from public.orders o where o.order_code = p_code and o.receipt_path is not null) then
    raise exception 'Sube el comprobante de transferencia para aprobar';
  end if;
  v_oc := 'OC-' || lpad(nextval('public.oc_seq')::text, 5, '0'); v_at := now();
  perform set_config('app.oc_rpc', '1', true);
  update public.orders o set oc_number = v_oc, paid_at = v_at, paid_clp = p_amount, oc_doc_token = v_tok,
         status = case when o.status in ('pendiente_pago','comprobante_recibido','pagado') then 'pagado' else o.status end
   where o.order_code = p_code and o.status <> 'cancelado';
  perform set_config('app.oc_rpc', '', true);
  select o.client_id into v_client from public.orders o where o.order_code = p_code limit 1;
  insert into public.notifications (user_id, message)
  values (v_client, coalesce((select cashier_name from public.settings where id = 1), 'Cheryl') || ' aprobó tu pago. Tu orden de compra ' || v_oc || ' está en Mis pedidos');
  return query select v_oc, v_at, v_tok;
end $$;
revoke execute on function public.approve_order(text, numeric) from public, anon;
grant execute on function public.approve_order(text, numeric) to authenticated;

-- Registrar envío (solo la shopper, solo pedidos con OC)
create or replace function public.register_shipment(p_code text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_client uuid;
begin
  if not public.is_shopper() then raise exception 'Solo la shopper puede registrar envíos'; end if;
  if length(trim(coalesce(p_data->>'tracking', ''))) < 4 then raise exception 'Falta el número de seguimiento'; end if;
  if not exists (select 1 from public.orders where order_code = p_code and oc_number is not null) then
    raise exception 'El pedido necesita su orden de compra antes de enviarse';
  end if;
  v := jsonb_strip_nulls(jsonb_build_object('courier', p_data->>'courier', 'tracking', upper(trim(p_data->>'tracking')), 'date', p_data->>'date',
        'kg', p_data->'kg', 'label', p_data->>'label', 'note', p_data->>'note', 'at', now(), 'by', 'cheryl'));
  perform set_config('app.oc_rpc', '1', true);
  update public.orders set shipment = v, status = 'enviado', dispatch_doc_token = coalesce(dispatch_doc_token, replace(gen_random_uuid()::text, '-', ''))
   where order_code = p_code and status <> 'cancelado';
  perform set_config('app.oc_rpc', '', true);
  select client_id into v_client from public.orders where order_code = p_code limit 1;
  insert into public.notifications (user_id, message)
  values (v_client, 'Tu pedido ' || p_code || ' va en camino a Chile. Seguimiento: ' || coalesce(v->>'courier', '') || ' ' || (v->>'tracking'));
  return v;
end $$;
revoke execute on function public.register_shipment(text, jsonb) from public, anon;
grant execute on function public.register_shipment(text, jsonb) to authenticated;

-- Marcar entregado (solo la shopper, solo pedidos enviados)
create or replace function public.mark_delivered(p_code text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_at timestamptz := now(); v_client uuid;
begin
  if not public.is_shopper() then raise exception 'Solo la shopper puede marcar entregas'; end if;
  if not exists (select 1 from public.orders where order_code = p_code and shipment is not null) then raise exception 'Primero registra el envío'; end if;
  perform set_config('app.oc_rpc', '1', true);
  update public.orders set status = 'entregado', delivered_at = v_at where order_code = p_code and status <> 'cancelado';
  perform set_config('app.oc_rpc', '', true);
  select client_id into v_client from public.orders where order_code = p_code limit 1;
  insert into public.notifications (user_id, message) values (v_client, 'Tu pedido ' || p_code || ' figura como entregado. ¡Gracias por tu compra!');
  return v_at;
end $$;
revoke execute on function public.mark_delivered(text) from public, anon;
grant execute on function public.mark_delivered(text) to authenticated;

-- Guarda el link de descarga del PDF (orden de compra o comprobante de despacho) que va por WhatsApp.
-- p_token: el de la orden (si aún no tenía, se usa el que manda la app, mínimo 16 caracteres).
create or replace function public.set_doc_url(p_code text, p_kind text, p_url text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_shopper() then raise exception 'Solo la shopper puede guardar documentos'; end if;
  if p_kind not in ('oc','despacho') then raise exception 'Documento inválido'; end if;
  if coalesce(p_url, '') <> '' and p_url !~ '/docs/' then raise exception 'El PDF debe estar en la carpeta docs/'; end if;
  perform set_config('app.oc_rpc', '1', true);
  if p_kind = 'oc' then
    update public.orders set oc_pdf_url = nullif(p_url, ''),
           oc_doc_token = coalesce(oc_doc_token, case when length(coalesce(p_token, '')) >= 16 then p_token end)
     where order_code = p_code and oc_number is not null;
  else
    update public.orders set dispatch_pdf_url = nullif(p_url, ''),
           dispatch_doc_token = coalesce(dispatch_doc_token, case when length(coalesce(p_token, '')) >= 16 then p_token end)
     where order_code = p_code and shipment is not null;
  end if;
  perform set_config('app.oc_rpc', '', true);
end $$;
revoke execute on function public.set_doc_url(text, text, text, text) from public, anon;
grant execute on function public.set_doc_url(text, text, text, text) to authenticated;

-- PDF en Storage: bucket público "photos", carpeta docs/ (ruta con token no adivinable). Solo la shopper sube
-- (la política "shopper sube fotos" ya lo cubre; esta lo deja explícito para docs/ y sin sobrescribir).
drop policy if exists "shopper sube documentos" on storage.objects;
create policy "shopper sube documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'docs' and public.is_shopper());
