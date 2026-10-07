-- Tabela "Valores por unidade para Combo" (2026) enviada pela loja.
-- Desconto progressivo do 10x15 e do 15x21, três preços de ampliação e a Polaroid ímã.

update public.products set price_tiers =
  '[{"min":20,"price_cents":179},{"min":50,"price_cents":169},{"min":100,"price_cents":119},{"min":300,"price_cents":109},{"min":500,"price_cents":99}]'
  where id = '10x15';
update public.products set price_tiers =
  '[{"min":20,"price_cents":389},{"min":50,"price_cents":379},{"min":100,"price_cents":349},{"min":300,"price_cents":329},{"min":500,"price_cents":309}]'
  where id = '15x21';

update public.products set price_cents = 1649 where id = '25x40';
update public.products set price_cents = 1769 where id = '25x50';
update public.products set price_cents = 2049 where id = '25x60';

insert into public.products
  (id, name, kind, width_cm, height_cm, price_cents, price_tiers, finishes, unit_weight_g, unit_thickness_mm, sort)
values
  ('polaroid-ima', 'Polaroid ímã', 'polaroid', 8.8, 10.7, 750, '[]', '{brilho}', 20, 1.5, 305)
on conflict (id) do update set
  name = excluded.name, price_cents = excluded.price_cents, unit_weight_g = excluded.unit_weight_g,
  unit_thickness_mm = excluded.unit_thickness_mm, sort = excluded.sort;
