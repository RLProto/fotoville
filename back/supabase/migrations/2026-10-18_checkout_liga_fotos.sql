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
