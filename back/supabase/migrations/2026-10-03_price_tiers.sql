-- Desconto por quantidade (aba Preços). Rode uma vez no SQL Editor do Supabase.
-- As duas linhas vão juntas: a coluna nasce vazia e, sem o update, o 10x15 perde o desconto.
alter table public.products add column if not exists price_tiers jsonb not null default '[]';

update public.products
   set price_tiers = '[{"min":100,"price_cents":119},{"min":300,"price_cents":109},{"min":500,"price_cents":99},{"min":1000,"price_cents":89}]'
 where id = '10x15';
