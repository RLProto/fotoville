-- Fotoville — catálogo inicial. Gerado por scripts/generate-seed.mts; não edite à mão.
-- Rode depois do schema.sql. Pode rodar de novo: atualiza nome, medidas e preço.

insert into public.products
  (id, name, kind, width_cm, height_cm, price_cents, price_tiers, finishes, unit_weight_g, unit_thickness_mm, sort)
values
  ('10x13', '10x13 cm', 'print', 10, 13, 199, '[]', '{brilho}', null, null, 10),
  ('10x15', '10x15 cm', 'print', 10, 15, 199, '[{"min":20,"price_cents":179},{"min":50,"price_cents":169},{"min":100,"price_cents":119},{"min":300,"price_cents":109},{"min":500,"price_cents":99}]', '{brilho}', null, null, 20),
  ('13x15', '13x15 cm', 'print', 13, 15, 209, '[]', '{brilho}', null, null, 30),
  ('13x18', '13x18 cm', 'print', 13, 18, 500, '[]', '{brilho}', null, null, 40),
  ('15x15', '15x15 cm', 'print', 15, 15, 329, '[]', '{brilho}', null, null, 50),
  ('15x21', '15x21 cm', 'print', 15, 21, 399, '[{"min":20,"price_cents":389},{"min":50,"price_cents":379},{"min":100,"price_cents":349},{"min":300,"price_cents":329},{"min":500,"price_cents":309}]', '{brilho}', null, null, 60),
  ('15x30', '15x30 cm', 'print', 15, 30, 659, '[]', '{brilho}', null, null, 70),
  ('20x20', '20x20 cm', 'print', 20, 20, 499, '[]', '{brilho}', null, null, 80),
  ('20x25', '20x25 cm', 'print', 20, 25, 599, '[]', '{brilho}', null, null, 90),
  ('20x30', '20x30 cm', 'print', 20, 30, 849, '[]', '{brilho}', null, null, 100),
  ('20x45', '20x45 cm', 'print', 20, 45, 1299, '[]', '{brilho}', null, null, 110),
  ('25x25', '25x25 cm', 'print', 25, 25, 749, '[]', '{brilho}', null, null, 120),
  ('25x30', '25x30 cm', 'print', 25, 30, 869, '[]', '{brilho}', null, null, 130),
  ('25x40', '25x40 cm', 'print', 25, 40, 1649, '[]', '{brilho}', null, null, 140),
  ('25x45', '25x45 cm', 'print', 25, 45, 1549, '[]', '{brilho}', null, null, 150),
  ('25x50', '25x50 cm', 'print', 25, 50, 1769, '[]', '{brilho}', null, null, 160),
  ('25x60', '25x60 cm', 'print', 25, 60, 2049, '[]', '{brilho}', null, null, 170),
  ('28x35', '28x35 cm', 'print', 28, 35, 2000, '[]', '{brilho}', null, null, 180),
  ('30x30', '30x30 cm', 'print', 30, 30, 1589, '[]', '{brilho}', null, null, 190),
  ('30x35', '30x35 cm', 'print', 30, 35, 1599, '[]', '{brilho}', null, null, 200),
  ('30x40', '30x40 cm', 'print', 30, 40, 1899, '[]', '{brilho}', null, null, 210),
  ('30x45', '30x45 cm', 'print', 30, 45, 2099, '[]', '{brilho}', null, null, 220),
  ('30x50', '30x50 cm', 'print', 30, 50, 2399, '[]', '{brilho}', null, null, 230),
  ('30x60', '30x60 cm', 'print', 30, 60, 2659, '[]', '{brilho}', null, null, 240),
  ('mini-polaroid', 'Mini Polaroid', 'polaroid', 5.4, 8.6, 350, '[]', '{brilho}', null, null, 295),
  ('polaroid', 'Polaroid', 'polaroid', 8.8, 10.7, 450, '[]', '{brilho}', null, null, 300),
  ('polaroid-ima', 'Polaroid ímã', 'polaroid', 8.8, 10.7, 750, '[]', '{brilho}', 20, 1.5, 305),
  ('foto-placa-20x30', 'Foto-placa 20x30 cm', 'placa', 20, 30, 2000, '[]', '{brilho}', 380, 4, 310)
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  width_cm = excluded.width_cm,
  height_cm = excluded.height_cm,
  price_cents = excluded.price_cents,
  price_tiers = excluded.price_tiers,
  finishes = excluded.finishes,
  unit_weight_g = excluded.unit_weight_g,
  unit_thickness_mm = excluded.unit_thickness_mm,
  sort = excluded.sort;

insert into public.packages
  (id, name, product_id, photo_count, price_cents, description, sort)
values
  ('pacote-100', '100 fotos 10x15', '10x15', 100, 11900, 'Compre agora e revele quando quiser.', 10),
  ('pacote-300', '300 fotos 10x15', '10x15', 300, 32700, 'Compre agora e revele quando quiser.', 20),
  ('pacote-500', '500 fotos 10x15', '10x15', 500, 49500, 'Compre agora e revele quando quiser.', 30),
  ('pacote-1000', '1000 fotos 10x15', '10x15', 1000, 89000, 'Compre agora e revele quando quiser.', 40)
on conflict (id) do update set
  name = excluded.name,
  product_id = excluded.product_id,
  photo_count = excluded.photo_count,
  price_cents = excluded.price_cents,
  description = excluded.description,
  sort = excluded.sort;
