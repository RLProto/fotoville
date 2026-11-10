-- Descrição do pedido: limite passa de 30 para 40 caracteres (cabe na etiqueta sem cortar a descrição).
alter table public.orders drop constraint if exists orders_note_check;
alter table public.orders add constraint orders_note_check
  check (note is null or char_length(note) between 1 and 40);
