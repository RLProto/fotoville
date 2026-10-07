-- As faixas de desconto progressivo de um perfil de cliente passam a usar as mesmas quantidades da loja
-- (1, 20, 50, 100, 300, 500): o perfil só muda o preço de cada faixa. O site já alinha ao ler, mas a linha
-- gravada do 10x15 do perfil 'Profissional 1' (faixas antigas 100/300/500/1000) fica igual ao que o site mostra.
-- A faixa de 1000 fotos a R$ 0,89 não existe mais na loja e sai do perfil também.

update public.profile_prices x
   set price_tiers = '[{"min":20,"price_cents":169},{"min":50,"price_cents":169},{"min":100,"price_cents":119},{"min":300,"price_cents":109},{"min":500,"price_cents":99}]'
  from public.price_profiles pp
 where pp.id = x.profile_id
   and pp.name = 'Profissional 1'
   and x.product_id = '10x15';
