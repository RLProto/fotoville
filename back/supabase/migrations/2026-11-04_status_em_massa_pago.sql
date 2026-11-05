-- Mudança de status em massa: "Pagamento aprovado" passa a valer para pedidos de fotos aguardando pagamento,
-- com os mesmos campos de markOrderPaid (front/src/lib/orders.ts). Pacote fica de fora, porque o cupom de
-- créditos dele é criado em markOrderPaid.
create or replace function public.bulk_order_status(p_ids uuid[], p_status text)
returns table (id uuid)
language sql set search_path = public, pg_temp as $$
  update public.orders o
     set status = p_status,
         paid_at = case when p_status = 'paid' then now() else o.paid_at end,
         mp_payment_id = case when p_status = 'paid' then null else o.mp_payment_id end,
         payment_method = case when p_status = 'paid' then 'manual' else o.payment_method end
   where o.id = any (p_ids)
     and case p_status
       when 'paid' then o.kind = 'prints' and o.status = 'pending'
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
