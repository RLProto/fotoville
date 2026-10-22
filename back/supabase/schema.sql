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

-- ---------------------------------------------------------------------------
-- Daqui para baixo: o conteúdo das migrações de back/supabase/migrations, na ordem.
-- O bot do WhatsApp (esquema monitor) fica só em 2026-10-04_whatsapp_monitor.sql e 2026-10-22_whatsapp_pedidos.sql: depende de pg_cron,
-- pg_net e da chave no Vault. O limite do bucket está em 2026-10-18_bucket_limites.sql.
-- ---------------------------------------------------------------------------

-- 2026-10-14_imagens_apagadas_e_armazenamento.sql
-- Painel da loja: limpeza das imagens de pedidos já produzidos e saúde do armazenamento.
--
-- orders.photos_deleted_at: quando a loja apagou as imagens do pedido do bucket. As linhas de
-- `photos` ficam (histórico de corte, cópias e ajustes); só os arquivos somem.
alter table public.orders add column if not exists photos_deleted_at timestamptz;

-- Uso do armazenamento para a aba "Armazenamento" do painel. Só o servidor (service role) chama.
-- Lê storage.objects, que é o que conta na cota do projeto, e agrupa as fotos por situação:
-- em carrinhos, em pedidos aguardando pagamento, em produção, ou concluídos (já podem ser apagadas).
create or replace function public.admin_storage_stats() returns jsonb
language plpgsql security definer set search_path = public, storage, pg_temp as $$
declare
  quota bigint := 100000000000; -- 100 GB, o mesmo padrão do bot do WhatsApp
  result jsonb;
begin
  begin
    select quota_bytes into quota from monitor.settings limit 1;
  exception when others then
    null; -- bot não instalado: fica o padrão
  end;

  with sizes as (
    select p.order_id, p.created_at,
      coalesce((o.metadata ->> 'size')::bigint, 0) + coalesce((t.metadata ->> 'size')::bigint, 0) as bytes,
      (o.id is not null) as stored
    from public.photos p
    left join storage.objects o on o.name = p.storage_key
    left join storage.objects t on t.name = p.thumb_key
  ),
  by_group as (
    select
      case
        when s.order_id is null then 'carrinho'
        when ord.status = 'pending' then 'aguardando'
        when ord.status in ('paid', 'in_production', 'ready_for_pickup') then 'producao'
        else 'concluido'
      end as grupo,
      count(*) as fotos,
      sum(s.bytes) as bytes
    from sizes s
    left join public.orders ord on ord.id = s.order_id
    where s.stored
    group by 1
  ),
  months as (
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes, count(*) as fotos, sum(bytes) as bytes
    from sizes
    where created_at >= date_trunc('month', now()) - interval '5 months'
    group by 1
    order by 1
  )
  select jsonb_build_object(
    'quota_bytes', quota,
    'total_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects),
    'total_files', (select count(*) from storage.objects),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('grupo', grupo, 'fotos', fotos, 'bytes', bytes)), '[]'::jsonb) from by_group),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'fotos', fotos, 'bytes', bytes)), '[]'::jsonb) from months),
    'orders_deleted', (select count(*) from public.orders where photos_deleted_at is not null),
    'orders_deletable', (
      select count(*) from public.orders o
      where o.photos_deleted_at is null
        and o.status in ('in_production', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled')
        and exists (select 1 from public.photos p where p.order_id = o.id)
    )
  ) into result;
  return result;
end $$;

revoke all on function public.admin_storage_stats() from public, anon, authenticated;
grant execute on function public.admin_storage_stats() to service_role;

-- 2026-10-14_motoboy.sql
-- Entrega por motoboy dentro de Joinville: um preço por bairro, editável no painel (aba Motoboy).
-- O cliente só vê a opção quando a cidade do endereço é Joinville e o bairro está nesta lista.
-- district_key é o nome sem acento, minúsculo e com espaços simples: é por ele que o bairro
-- digitado (ou vindo do ViaCEP) é comparado.
create table if not exists public.motoboy_zones (
  id uuid primary key default gen_random_uuid(),
  district text not null check (length(trim(district)) between 2 and 60),
  district_key text not null unique,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sem políticas: só o servidor (service role) lê e grava.
alter table public.motoboy_zones enable row level security;

-- Os 20 bairros mais populosos (Censo 2022, IBGE), a R$ 19,90. Pode rodar de novo: não duplica.
insert into public.motoboy_zones (district, district_key, price_cents)
values
  ('Aventureiro', 'aventureiro', 1990),
  ('Costa e Silva', 'costa e silva', 1990),
  ('Paranaguamirim', 'paranaguamirim', 1990),
  ('Vila Nova', 'vila nova', 1990),
  ('Jardim Iririú', 'jardim iririu', 1990),
  ('Iririú', 'iririu', 1990),
  ('Jardim Paraíso', 'jardim paraiso', 1990),
  ('Floresta', 'floresta', 1990),
  ('Itaum', 'itaum', 1990),
  ('Boa Vista', 'boa vista', 1990),
  ('Comasa', 'comasa', 1990),
  ('Jarivatuba', 'jarivatuba', 1990),
  ('Nova Brasília', 'nova brasilia', 1990),
  ('Bucarein', 'bucarein', 1990),
  ('Centro', 'centro', 1990),
  ('América', 'america', 1990),
  ('Glória', 'gloria', 1990),
  ('Saguaçu', 'saguacu', 1990),
  ('Bom Retiro', 'bom retiro', 1990),
  ('Fátima', 'fatima', 1990)
on conflict (district_key) do nothing;

-- 2026-10-15_estatisticas.sql
-- Aba Estatísticas do painel: visitas por dia (contador próprio), pedidos, cadastros e vendas.
--
-- page_views: uma linha por página aberta no site (fora do painel). `visitor` é um hash do dia com
-- IP e navegador, calculado no servidor e sem volta: serve só para contar visitantes únicos no dia.
-- Nem IP nem cookie ficam guardados.
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  day date not null,
  path text not null,
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists page_views_day_idx on public.page_views (day);

-- Sem políticas: só o servidor (service role) grava e lê.
alter table public.page_views enable row level security;

-- Séries por dia e totais do período, em horário de Brasília. Só o servidor chama.
create or replace function public.admin_stats(days integer default 30) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  tz constant text := 'America/Sao_Paulo';
  first_day date := (now() at time zone tz)::date - (greatest(1, least(days, 365)) - 1);
  result jsonb;
begin
  with dias as (
    select d::date as day from generate_series(first_day, (now() at time zone tz)::date, interval '1 day') as d
  ),
  visitas as (
    select day, count(*) as views, count(distinct visitor) as visitors
    from public.page_views where day >= first_day group by day
  ),
  pedidos as (
    select (created_at at time zone tz)::date as day, count(*) as orders
    from public.orders where (created_at at time zone tz)::date >= first_day group by 1
  ),
  pagos as (
    select (paid_at at time zone tz)::date as day, count(*) as paid, sum(total_cents) as revenue_cents
    from public.orders where paid_at is not null and (paid_at at time zone tz)::date >= first_day group by 1
  ),
  cadastros as (
    select (created_at at time zone tz)::date as day, count(*) as signups
    from public.profiles where (created_at at time zone tz)::date >= first_day group by 1
  ),
  serie as (
    select d.day,
      coalesce(v.views, 0) as views, coalesce(v.visitors, 0) as visitors,
      coalesce(p.orders, 0) as orders, coalesce(g.paid, 0) as paid, coalesce(g.revenue_cents, 0) as revenue_cents,
      coalesce(c.signups, 0) as signups
    from dias d
    left join visitas v on v.day = d.day
    left join pedidos p on p.day = d.day
    left join pagos g on g.day = d.day
    left join cadastros c on c.day = d.day
    order by d.day
  ),
  pagos_periodo as (
    select * from public.orders where paid_at is not null and (paid_at at time zone tz)::date >= first_day
  ),
  tamanhos as (
    select i.product_id, coalesce(pr.name, i.description) as name, sum(i.quantity) as copies
    from public.order_items i
    join pagos_periodo o on o.id = i.order_id
    left join public.products pr on pr.id = i.product_id
    where o.kind = 'prints'
    group by i.product_id, coalesce(pr.name, i.description)
    order by copies desc
    limit 8
  ),
  entregas as (
    select coalesce(shipping_service, 'nenhuma') as service, count(*) as orders
    from pagos_periodo group by 1 order by orders desc
  )
  select jsonb_build_object(
    'days', (select jsonb_agg(jsonb_build_object(
        'day', to_char(day, 'YYYY-MM-DD'), 'views', views, 'visitors', visitors,
        'orders', orders, 'paid', paid, 'revenue_cents', revenue_cents, 'signups', signups)) from serie),
    'totals', (select jsonb_build_object(
        'views', sum(views), 'visitors', (select count(distinct visitor) from public.page_views where day >= first_day),
        'orders', sum(orders), 'paid', sum(paid), 'revenue_cents', sum(revenue_cents), 'signups', sum(signups)) from serie),
    'sizes', (select coalesce(jsonb_agg(jsonb_build_object('id', product_id, 'name', name, 'copies', copies)), '[]'::jsonb) from tamanhos),
    'delivery', (select coalesce(jsonb_agg(jsonb_build_object('service', service, 'orders', orders)), '[]'::jsonb) from entregas),
    'tracking_since', (select to_char(min(day), 'YYYY-MM-DD') from public.page_views)
  ) into result;
  return result;
end $$;

revoke all on function public.admin_stats(integer) from public, anon, authenticated;
grant execute on function public.admin_stats(integer) to service_role;

-- 2026-10-15_historico_do_pedido.sql
-- Histórico do pedido: quando entrou em cada situação, para a linha do tempo no painel.
-- Um gatilho grava a cada mudança de status, por qualquer caminho (webhook, painel, manual).
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- Sem políticas: só o servidor (service role) lê.
alter table public.order_events enable row level security;

create or replace function public.log_order_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, status, created_at) values (new.id, new.status, new.created_at);
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, status, created_at)
    values (new.id, new.status, case when new.status = 'paid' and new.paid_at is not null then new.paid_at else now() end);
  end if;
  return new;
end $$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Pedidos antigos: a criação e o pagamento têm data conhecida; as outras situações não.
insert into public.order_events (order_id, status, created_at)
select id, 'pending', created_at from public.orders o
where not exists (select 1 from public.order_events e where e.order_id = o.id and e.status = 'pending');

insert into public.order_events (order_id, status, created_at)
select id, 'paid', paid_at from public.orders o
where paid_at is not null
  and not exists (select 1 from public.order_events e where e.order_id = o.id and e.status = 'paid');

-- 2026-10-18_checkout_liga_fotos.sql
-- Checkout: liga ao pedido, numa operação só, as fotos do carrinho de tamanhos ativos e devolve quantas
-- fotos e cópias ligou de cada tamanho. O checkout compara com o que cobrou e desfaz o pedido se mudou.
-- Substitui a lista de ids na URL, que quebrava a partir de ~600 fotos, e fecha a corrida com quem
-- muda cópias ou fecha o pedido em outra aba ao mesmo tempo.
create or replace function public.claim_cart_photos(p_order uuid, p_user uuid)
returns table (product_id text, files integer, copies integer)
language sql set search_path = public, pg_temp as $$
  with claimed as (
    update public.photos p
       set order_id = p_order
     where p.user_id = p_user
       and p.order_id is null
       and exists (select 1 from public.products pr where pr.id = p.product_id and pr.active)
    returning p.product_id, p.quantity
  )
  select c.product_id, count(*)::integer, sum(c.quantity)::integer
    from claimed c
   group by c.product_id
$$;

revoke all on function public.claim_cart_photos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_cart_photos(uuid, uuid) to service_role;

-- 2026-10-18_fotos_em_lote.sql
-- Grava de uma vez a mesma ação em várias fotos do carrinho de um tamanho ("Aplicar a todas", ajuste
-- automático, borda em todas). Antes eram centenas de requisições ao mesmo tempo; se uma falhava, a tela
-- voltava tudo, mas parte já estava gravada. Agora é uma transação: grava todas ou nenhuma.
-- Roda com a sessão do cliente: a RLS e as colunas liberadas para ele valem aqui também.
-- p_changes: [{ "id": "<uuid>", "quantity": 3 }] ou [{ "id": "<uuid>", "adjust": {...} | null }]
create or replace function public.update_cart_photos(p_product text, p_changes jsonb)
returns integer
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  changed integer;
begin
  update public.photos p
     set quantity = case when c.value ? 'quantity' then (c.value ->> 'quantity')::integer else p.quantity end,
         adjust = case when c.value ? 'adjust' then nullif(c.value -> 'adjust', 'null'::jsonb) else p.adjust end
    from jsonb_array_elements(p_changes) c
   where p.id = (c.value ->> 'id')::uuid
     and p.user_id = auth.uid()
     and p.order_id is null
     and p.product_id = p_product;
  get diagnostics changed = row_count;
  -- Foto que saiu do carrinho (pedido fechado, removida em outra aba): não grava nenhuma
  if changed <> jsonb_array_length(p_changes) then
    raise exception 'fotos_fora_do_carrinho' using errcode = 'P0001';
  end if;
  return changed;
end $$;

revoke all on function public.update_cart_photos(text, jsonb) from public, anon;
grant execute on function public.update_cart_photos(text, jsonb) to authenticated;

-- 2026-10-18_tentativas_de_cupom.sql
-- Códigos de cupom digitados que não existem, para limitar tentativas (um código curto dá para adivinhar
-- tentando em sequência). /api/cupom e o checkout contam por cliente e por endereço de internet.
create table if not exists public.coupon_misses (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists coupon_misses_user_idx on public.coupon_misses (user_id, created_at);
create index if not exists coupon_misses_ip_idx on public.coupon_misses (ip, created_at);

-- Sem políticas: só o servidor (service role) lê e grava.
alter table public.coupon_misses enable row level security;
revoke all on public.coupon_misses from anon, authenticated;

-- Só a última meia hora importa: o resto é apagado todo dia.
do $$ begin
  -- Projeto sem pg_cron: a tabela só cresce com códigos errados, e dá para apagar à mão
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('limpar-tentativas-cupom', '17 6 * * *', 'delete from public.coupon_misses where created_at < now() - interval ''1 day''');
  end if;
end $$;

-- 2026-10-18_arquivos_orfaos.sql
-- Arquivos do bucket sem foto no banco: o envio caiu entre o arquivo e o registro, ou a remoção não
-- conseguiu apagar o arquivo. O job diário (/api/cron/carrinho) apaga pela API do Storage, que é o único
-- jeito de apagar o arquivo de verdade; aqui só lista.
-- Só arquivos da pasta dos clientes (u/) com mais de 2 dias, para nunca pegar um envio em andamento.

create index if not exists photos_storage_key_idx on public.photos (storage_key);
create index if not exists photos_thumb_key_idx on public.photos (thumb_key) where thumb_key is not null;

create or replace function public.orphan_objects(p_bucket text, p_limit integer default 1000)
returns table (name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.name
    from storage.objects o
   where o.bucket_id = p_bucket
     and o.name like 'u/%'
     and o.created_at < now() - interval '2 days'
     and not exists (select 1 from public.photos p where p.storage_key = o.name)
     and not exists (select 1 from public.photos p where p.thumb_key = o.name)
   order by o.created_at
   limit p_limit
$$;

revoke all on function public.orphan_objects(text, integer) from public, anon, authenticated;
grant execute on function public.orphan_objects(text, integer) to service_role;
