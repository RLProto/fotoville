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
  finishes text[] not null default '{brilho,fosco}',
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
  quantity integer not null default 1 check (quantity between 1 and 999),
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

drop policy if exists "fotos proprias - criar" on public.photos;
create policy "fotos proprias - criar" on public.photos
  for insert with check (auth.uid() = user_id and order_id is null);

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
