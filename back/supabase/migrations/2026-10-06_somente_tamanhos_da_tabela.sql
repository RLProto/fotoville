-- Ficam só os tamanhos da tabela "Valores por unidade para Combo" (2026), mais Mini Polaroid e Polaroid ímã.
-- Desativa em vez de apagar: pedidos antigos continuam apontando para o produto.
update public.products set active = false
 where id in ('15x30', '20x45', '25x45', '28x35', '30x35', 'foto-placa-20x30');
