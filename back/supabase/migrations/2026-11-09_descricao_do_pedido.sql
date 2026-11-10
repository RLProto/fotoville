-- Descrição do pedido ("Casamento Ana"): o cliente ou a loja dá um nome curto ao pedido, que sai na
-- etiqueta entre parênteses. As regras de texto ficam em front/src/lib/order-note.ts; aqui só o tamanho.
-- O cliente não grava direto: PATCH /api/pedidos/[id] confere a regra e grava com a service role.
alter table public.orders add column if not exists note text;

alter table public.orders drop constraint if exists orders_note_check;
alter table public.orders add constraint orders_note_check
  check (note is null or char_length(note) between 1 and 30);
