-- Fotoville — schema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase. Depois rode seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  whatsapp text,
  cpf text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
-- Super admin: vê a aba Erros do painel
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
-- false = o cliente pediu para parar os avisos pelo WhatsApp (aviso do carrinho)
alter table public.profiles add column if not exists whatsapp_avisos boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, whatsapp)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'whatsapp'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id text primary key,                       -- slug, ex.: '10x15'
  name text not null,
  kind text not null default 'print' check (kind in ('print', 'polaroid', 'placa')),
  width_cm numeric(5, 1) not null,
  height_cm numeric(5, 1) not null,
  price_cents integer not null check (price_cents >= 0),
  price_tiers jsonb not null default '[]',   -- desconto progressivo: [{ "min": 100, "price_cents": 119 }, ...]
  finishes text[] not null default '{brilho}',       -- acabamento único; não aparece no site
  unit_weight_g numeric(7, 2),               -- null = calcula pela área do papel
  unit_thickness_mm numeric(5, 2),           -- null = espessura padrão do papel
  sort integer not null default 0,
  active boolean not null default true
);

alter table public.products add column if not exists price_tiers jsonb not null default '[]';

create table if not exists public.packages (
  id text primary key,                       -- slug, ex.: 'pacote-100'
  name text not null,
  product_id text not null references public.products (id),
  photo_count integer not null check (photo_count > 0),
  price_cents integer not null check (price_cents >= 0),
  description text,
  sort integer not null default 0,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001),
  user_id uuid not null references auth.users (id),
  kind text not null default 'prints' check (kind in ('prints', 'package')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'in_production', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled')),
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  coupon_code text,
  package_id text references public.packages (id),
  customer jsonb,                            -- { name, cpf, whatsapp, email }
  shipping_service text,                     -- 'pac' | 'sedex' | 'retirada'
  shipping_label text,
  shipping_days integer,
  shipping_estimated boolean not null default false,
  shipping_address jsonb,                    -- { cep, street, number, complement, district, city, state }
  parcel jsonb,                              -- { weight_g, length_cm, width_cm, height_cm }
  tracking_code text,
  mp_preference_id text,
  mp_init_point text,
  mp_payment_id text,
  payment_method text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text references public.products (id),
  description text not null,
  finish text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  total_cents integer not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Fotos (order_id nulo = ainda no carrinho)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id),
  order_id uuid references public.orders (id) on delete set null,
  storage_key text not null,
  thumb_key text,
  file_name text not null,
  width_px integer not null,
  height_px integer not null,
  crop jsonb,                                -- { x, y, width, height } em pixels do original
  fit boolean not null default false,        -- true = foto inteira, sem cortar
  adjust jsonb,                              -- cor, borda e legenda (ver Adjust em src/lib/types.ts); null = nenhum
  finish text not null default 'brilho',
  quantity integer not null default 1 check (quantity between 1 and 10000),
  created_at timestamptz not null default now()
);
-- Bancos criados antes dos ajustes de foto (out/2026)
alter table public.photos add column if not exists adjust jsonb;
create index if not exists photos_cart_idx on public.photos (user_id) where order_id is null;
create index if not exists photos_order_idx on public.photos (order_id);

-- ---------------------------------------------------------------------------
-- Cupons
--   credits: vale N fotos de um produto (gerado na compra de pacote)
--   percent: desconto percentual sobre as fotos
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  code text primary key,
  kind text not null default 'credits' check (kind in ('credits', 'percent')),
  user_id uuid references auth.users (id),
  product_id text references public.products (id),
  credits_total integer not null default 0,
  credits_used integer not null default 0,
  percent_off integer check (percent_off between 1 and 100),
  source_order_id uuid references public.orders (id),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (credits_used <= credits_total)
);
create index if not exists coupons_user_idx on public.coupons (user_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.coupons (code),
  order_id uuid not null references public.orders (id) on delete cascade,
  credits integer not null default 0,
  discount_cents integer not null default 0,
  created_at timestamptz not null default now()
);

-- Consome créditos de forma atômica. Retorna true se havia saldo.
create or replace function public.redeem_coupon_credits(p_code text, p_credits integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  update public.coupons
     set credits_used = credits_used + p_credits
   where code = p_code
     and active
     and (expires_at is null or expires_at > now())
     and credits_used + p_credits <= credits_total;
  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;
revoke all on function public.redeem_coupon_credits(text, integer) from public, anon, authenticated;

-- Cupons percentuais da aba Cupons do painel. Um uso é um pedido não cancelado com o cupom.
alter table public.coupons
  add column if not exists description text,
  add column if not exists min_order_cents integer not null default 0 check (min_order_cents >= 0),
  add column if not exists max_uses integer check (max_uses > 0),               -- null: sem limite
  add column if not exists once_per_customer boolean not null default false;

-- Código criado no painel: só letras maiúsculas e números, de 3 a 20 (o de pacote é gerado, FV-XXXX-XXXX)
alter table public.coupons drop constraint if exists coupons_percent_code_check;
alter table public.coupons add constraint coupons_percent_code_check
  check (kind <> 'percent' or code ~ '^[A-Z0-9]{3,20}$');

create index if not exists coupon_redemptions_code_idx on public.coupon_redemptions (code);

-- Por que o cupom percentual não vale para este cliente e este subtotal, ou null se vale.
-- Respostas: not_found, inactive, expired, min_order, limit, customer.
create or replace function public.coupon_problem(p_code text, p_user uuid, p_subtotal integer)
returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  c public.coupons;
begin
  select * into c from public.coupons where code = p_code and kind = 'percent';
  if not found then return 'not_found'; end if;
  if not c.active then return 'inactive'; end if;
  if c.expires_at is not null and c.expires_at <= now() then return 'expired'; end if;
  if p_subtotal < c.min_order_cents then return 'min_order'; end if;
  if c.max_uses is not null and (
    select count(*) from public.coupon_redemptions r join public.orders o on o.id = r.order_id
     where r.code = p_code and o.status <> 'cancelled'
  ) >= c.max_uses then return 'limit'; end if;
  if c.once_per_customer and exists (
    select 1 from public.coupon_redemptions r join public.orders o on o.id = r.order_id
     where r.code = p_code and o.status <> 'cancelled' and o.user_id = p_user
  ) then return 'customer'; end if;
  return null;
end;
$$;

-- Registra o uso do cupom no pedido, conferindo tudo de novo com o cupom travado:
-- dois pedidos ao mesmo tempo não passam do limite. Devolve null se registrou, senão o problema.
create or replace function public.redeem_percent_coupon(p_code text, p_order uuid, p_subtotal integer, p_discount integer)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  problem text;
begin
  perform 1 from public.coupons where code = p_code for update;
  problem := public.coupon_problem(p_code, (select user_id from public.orders where id = p_order), p_subtotal);
  if problem is not null then return problem; end if;
  insert into public.coupon_redemptions (code, order_id, credits, discount_cents) values (p_code, p_order, 0, p_discount);
  return null;
end;
$$;

revoke all on function public.coupon_problem(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.redeem_percent_coupon(text, uuid, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registro de erros do site (navegador do cliente e servidor), para investigar e corrigir.
-- Lido no painel em /admin/erros. Sugestão de limpeza periódica:
--   delete from public.error_logs where created_at < now() - interval '90 days';
-- ---------------------------------------------------------------------------
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null default 'error' check (level in ('error', 'warning')),
  source text not null check (source in ('client', 'server')),
  scope text not null,                       -- área: envio, editor, checkout, pagamento, frete, api...
  message text not null,
  detail jsonb,                              -- contexto: arquivo, etapa, ids, pilha do erro
  url text,                                  -- página ou rota onde aconteceu
  user_id uuid references auth.users (id) on delete set null,
  user_agent text,
  env text not null default 'production',    -- 'development' quando veio do next dev
  resolved_at timestamptz                    -- preenchido quando o problema foi resolvido
);
create index if not exists error_logs_recent_idx on public.error_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Fotos esquecidas no carrinho: aviso pelo WhatsApp e limpeza (src/lib/cart-retention.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.cart_notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- foto mais recente do carrinho quando o aviso saiu: foto nova depois disso cancela o aviso
  last_activity timestamptz not null,
  delete_after timestamptz not null,
  -- enviado, entregue, lido, falhou, sem_whatsapp, sem_avisos, sem_config
  status text not null,
  message_id text,
  error text,
  deleted_at timestamptz,
  deleted_photos integer,
  created_at timestamptz not null default now(),
  unique (user_id, last_activity)
);
create index if not exists cart_notices_message_idx on public.cart_notices (message_id) where message_id is not null;

-- Só o servidor (service role) lê e grava.
alter table public.cart_notices enable row level security;
revoke all on public.cart_notices from anon, authenticated;

-- Carrinhos parados desde `idle_since`, com o aviso que vale para a atividade atual (se houver).
create or replace function public.stale_carts(idle_since timestamptz)
returns table (
  user_id uuid,
  last_activity timestamptz,
  files integer,
  whatsapp text,
  whatsapp_avisos boolean,
  notice_id bigint,
  delete_after timestamptz,
  deleted_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  with carts as (
    select p.user_id, max(p.created_at) as last_activity, count(*)::integer as files
    from public.photos p
    where p.order_id is null
    group by p.user_id
  )
  select c.user_id, c.last_activity, c.files, pr.whatsapp, coalesce(pr.whatsapp_avisos, true),
    n.id, n.delete_after, n.deleted_at
  from carts c
  left join public.profiles pr on pr.id = c.user_id
  left join public.cart_notices n on n.user_id = c.user_id and n.last_activity = c.last_activity
  where c.last_activity <= idle_since
  order by c.last_activity
$$;

revoke execute on function public.stale_carts(timestamptz) from public, anon, authenticated;
grant execute on function public.stale_carts(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Perfis de preço (clientes preferenciais)
-- Cada perfil tem tabela própria; tamanho sem linha no perfil usa o preço da loja.
-- ---------------------------------------------------------------------------
create table if not exists public.price_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.profile_prices (
  profile_id uuid not null references public.price_profiles (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  price_tiers jsonb not null default '[]',
  primary key (profile_id, product_id)
);

-- Perfil de cada cliente, à parte do cadastro: o cliente nunca escolhe o próprio perfil.
create table if not exists public.customer_price_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile_id uuid not null references public.price_profiles (id) on delete cascade,
  assigned_at timestamptz not null default now()
);
create index if not exists customer_price_profiles_profile_idx on public.customer_price_profiles (profile_id);

alter table public.orders add column if not exists price_profile_name text;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- O site grava pedidos, itens e cupons só pelo servidor (service role),
-- que ignora RLS. As políticas abaixo valem para o cliente logado.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.packages enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.photos enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
-- Perfis de preço: sem políticas, só o servidor lê e grava.
alter table public.price_profiles enable row level security;
alter table public.profile_prices enable row level security;
alter table public.customer_price_profiles enable row level security;

-- Sem políticas: só o servidor (service role) grava e lê o registro de erros.
alter table public.error_logs enable row level security;

drop policy if exists "catalogo publico" on public.products;
create policy "catalogo publico" on public.products for select using (true);

drop policy if exists "pacotes publicos" on public.packages;
create policy "pacotes publicos" on public.packages for select using (true);

drop policy if exists "perfil proprio - ler" on public.profiles;
create policy "perfil proprio - ler" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "perfil proprio - editar" on public.profiles;
create policy "perfil proprio - editar" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- is_admin não pode ser alterado pelo próprio usuário: só estas colunas são editáveis
revoke update on public.profiles from anon, authenticated;
grant update (full_name, whatsapp, cpf) on public.profiles to authenticated;

drop policy if exists "pedidos proprios" on public.orders;
create policy "pedidos proprios" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "itens dos pedidos proprios" on public.order_items;
create policy "itens dos pedidos proprios" on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
  ));

drop policy if exists "fotos proprias - ler" on public.photos;
create policy "fotos proprias - ler" on public.photos
  for select using (auth.uid() = user_id);

-- O arquivo precisa estar na pasta do próprio cliente (u/<id>/), a mesma que /api/upload/presign assina
drop policy if exists "fotos proprias - criar" on public.photos;
create policy "fotos proprias - criar" on public.photos
  for insert with check (
    auth.uid() = user_id
    and order_id is null
    and starts_with(storage_key, 'u/' || auth.uid()::text || '/')
    and (thumb_key is null or starts_with(thumb_key, 'u/' || auth.uid()::text || '/'))
  );

-- Colunas que o cliente grava: as de POST /api/photos e as do editor. Caminho do arquivo, dono, pedido e
-- data ficam de fora, mesmo chamando o Supabase direto.
revoke insert, update, truncate, references, trigger on public.photos from anon, authenticated;
grant insert (user_id, product_id, storage_key, thumb_key, file_name, width_px, height_px, crop, finish, quantity)
  on public.photos to authenticated;
grant update (crop, fit, adjust, finish, quantity) on public.photos to authenticated;

drop policy if exists "fotos proprias - editar no carrinho" on public.photos;
create policy "fotos proprias - editar no carrinho" on public.photos
  for update using (auth.uid() = user_id and order_id is null)
  with check (auth.uid() = user_id and order_id is null);

drop policy if exists "fotos proprias - apagar do carrinho" on public.photos;
create policy "fotos proprias - apagar do carrinho" on public.photos
  for delete using (auth.uid() = user_id and order_id is null);

drop policy if exists "cupons proprios" on public.coupons;
create policy "cupons proprios" on public.coupons
  for select using (auth.uid() = user_id);

-- Para tornar alguém administrador (rode manualmente):
-- update public.profiles set is_admin = true
--  where id = (select id from auth.users where email = 'email@exemplo.com');
-- Super admin (aba Erros): o mesmo, com is_admin = true, is_super_admin = true
