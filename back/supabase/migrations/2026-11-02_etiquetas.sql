-- Aba Etiquetas do painel: a etiqueta fica disponível quando a loja baixa as fotos do pedido,
-- e é marcada como impressa quando entra num PDF.
alter table public.orders
  add column if not exists label_ready_at timestamptz,
  add column if not exists label_printed_at timestamptz;

create index if not exists orders_label_ready_idx
  on public.orders (label_ready_at desc)
  where label_ready_at is not null;
