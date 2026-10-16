-- Fotos esquecidas no carrinho: aviso pelo WhatsApp e depois limpeza do bucket.
--
-- O prazo conta da foto mais recente do carrinho (src/lib/cart-retention.ts). Quando faltam poucos
-- dias, o job diário (/api/cron/carrinho) grava um aviso aqui e manda a mensagem. As fotos só são
-- apagadas depois de `delete_after`, que nunca fica a menos de alguns dias do aviso.

-- false = o cliente tocou em "Parar avisos" ou respondeu PARAR.
alter table public.profiles add column if not exists whatsapp_avisos boolean not null default true;

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
