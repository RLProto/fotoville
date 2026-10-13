-- Medida real do papel da impressora em cada tamanho. O nome comercial (10x15) continua no `name`;
-- largura e altura passam a ser as que a impressora conhece (10,2 x 15,2). O recorte, a prévia e o
-- arquivo de impressão usam estas medidas. Polaroid: papel 8,2 x 10,2 com janela 7 x 7.
-- Mini Polaroid e Polaroid ímã não mudam.
update public.products as p set width_cm = v.w, height_cm = v.h
from (values
  ('10x13', 10.2, 12.7),
  ('10x15', 10.2, 15.2),
  ('13x15', 12.7, 15.2),
  ('13x18', 12.7, 18),
  ('15x15', 15.2, 15.2),
  ('15x21', 15.2, 21.4),
  ('20x20', 20.3, 20.3),
  ('20x25', 20.3, 25.4),
  ('20x30', 20.3, 30.5),
  ('25x25', 25.4, 25.4),
  ('25x30', 25.4, 30.5),
  ('25x40', 25.4, 40),
  ('25x50', 25.4, 50),
  ('25x60', 25.4, 60),
  ('30x30', 30.5, 30.5),
  ('30x40', 30.5, 40),
  ('30x45', 30.5, 45),
  ('30x50', 30.5, 50),
  ('30x60', 30.5, 60),
  ('polaroid', 8.2, 10.2)
) as v(id, w, h)
where p.id = v.id;
