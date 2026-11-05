-- Painel: muda o status de vários pedidos de uma vez e devolve os que mudaram. O status atual é conferido
-- na hora de gravar: o que mudou desde que a lista abriu (pagamento chegando, outra aba) fica de fora.
-- A lista de ids vai no corpo da chamada, porque na URL ela falha com centenas de pedidos.
-- As regras se repetem em canBulkChange (front/src/lib/order-rules.ts); npm run check:status confere as duas.
-- "Pagamento aprovado" não entra: tem efeitos próprios em markOrderPaid.
create or replace function public.bulk_order_status(p_ids uuid[], p_status text)
returns table (id uuid)
language sql set search_path = public, pg_temp as $$
  update public.orders o
     set status = p_status
   where o.id = any (p_ids)
     and case p_status
       when 'in_production' then o.kind = 'prints' and o.status = 'paid'
       when 'shipped' then o.kind = 'prints' and o.status = 'in_production' and o.shipping_service is distinct from 'retirada'
       when 'ready_for_pickup' then o.kind = 'prints' and o.status = 'in_production' and o.shipping_service = 'retirada'
       when 'delivered' then o.status in ('shipped', 'ready_for_pickup')
       when 'cancelled' then o.status = 'pending'
       else false
     end
  returning o.id
$$;

revoke all on function public.bulk_order_status(uuid[], text) from public, anon, authenticated;
grant execute on function public.bulk_order_status(uuid[], text) to service_role;

-- Etiquetas que entraram num PDF: mesma razão, a seleção pode ter centenas de pedidos.
create or replace function public.mark_labels_printed(p_ids uuid[])
returns void
language sql set search_path = public, pg_temp as $$
  update public.orders
     set label_printed_at = now()
   where id = any (p_ids)
     and label_ready_at is not null
$$;

revoke all on function public.mark_labels_printed(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_labels_printed(uuid[]) to service_role;
