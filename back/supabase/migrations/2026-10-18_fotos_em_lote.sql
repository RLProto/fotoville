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
