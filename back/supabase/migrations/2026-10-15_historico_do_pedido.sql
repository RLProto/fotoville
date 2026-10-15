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
