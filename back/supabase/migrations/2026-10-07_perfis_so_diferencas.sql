-- O perfil de cliente passa a guardar só o que difere da tabela da loja. Tamanho sem linha segue a loja,
-- inclusive quando ela mudar. Apaga as linhas iguais à loja e as cópias antigas da tabela de 04/10
-- que ficaram para trás na tabela 2026 (15x21 sem faixas; 25x40, 25x50 e 25x60 com o preço antigo).

delete from public.profile_prices x
 using public.products p
 where p.id = x.product_id
   and x.price_cents = p.price_cents
   and x.price_tiers = p.price_tiers;

delete from public.profile_prices x
 using public.price_profiles pp
 where pp.id = x.profile_id
   and pp.name = 'Profissional 1'
   and x.product_id in ('15x21', '25x40', '25x50', '25x60');
