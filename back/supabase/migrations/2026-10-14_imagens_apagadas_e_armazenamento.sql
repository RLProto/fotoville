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
