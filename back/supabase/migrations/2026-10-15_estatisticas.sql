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
