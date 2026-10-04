-- Um só acabamento em todos os tamanhos (não aparece no site) e até 10.000 cópias por foto.

update public.products set finishes = '{brilho}';
alter table public.products alter column finishes set default '{brilho}';
update public.products set name = '13x18 cm' where id = '13x18';

-- Fotos ainda no carrinho passam para o acabamento único; pedidos já feitos ficam como estão.
update public.photos set finish = 'brilho' where order_id is null and finish <> 'brilho';

alter table public.photos drop constraint if exists photos_quantity_check;
alter table public.photos add constraint photos_quantity_check check (quantity between 1 and 10000);
