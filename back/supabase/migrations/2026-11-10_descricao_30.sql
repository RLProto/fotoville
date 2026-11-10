-- Descrição do pedido: limite volta para 30 caracteres. O que passar disso é cortado em 30.
update public.orders set note = rtrim(left(note, 30)) where char_length(note) > 30;
alter table public.orders drop constraint if exists orders_note_check;
alter table public.orders add constraint orders_note_check
  check (note is null or char_length(note) between 1 and 30);
