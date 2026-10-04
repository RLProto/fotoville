-- Perfis de preço para clientes preferenciais. Rode depois de 2026-10-03_price_tiers.sql.
-- Cada perfil tem uma tabela própria (preço e desconto progressivo por tamanho). Tamanho sem linha no perfil
-- usa o preço da loja. Só o servidor (service role) lê e escreve: RLS ligado e sem políticas.

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

-- Perfil de cada cliente. Tabela à parte do cadastro: o cliente nunca escolhe o próprio perfil.
create table if not exists public.customer_price_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile_id uuid not null references public.price_profiles (id) on delete cascade,
  assigned_at timestamptz not null default now()
);
create index if not exists customer_price_profiles_profile_idx on public.customer_price_profiles (profile_id);

-- Nome do perfil no momento da compra, para o painel saber com que tabela o pedido foi cobrado.
alter table public.orders add column if not exists price_profile_name text;

alter table public.price_profiles enable row level security;
alter table public.profile_prices enable row level security;
alter table public.customer_price_profiles enable row level security;
