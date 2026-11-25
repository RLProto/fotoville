-- Polaroid ímã passa a ter a medida da Polaroid: papel 8,2 x 10,2 com janela 7 x 7.
update public.products set width_cm = 8.2, height_cm = 10.2 where id = 'polaroid-ima';
