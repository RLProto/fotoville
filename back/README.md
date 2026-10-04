# Banco (Supabase)

O site não tem servidor próprio: o banco, o login e as fotos ficam no Supabase. Esta pasta guarda a estrutura
do banco. Tudo se roda no **SQL Editor** do painel do Supabase.

| Arquivo | Quando rodar |
|---|---|
| `supabase/schema.sql` | Banco novo. Cria tabelas, regras de acesso (RLS) e funções. Pode rodar de novo sem perder dados. |
| `supabase/seed.sql` | Depois do schema. Carrega tamanhos, preços e pacotes. Rodar de novo **sobrescreve** os preços. |
| `supabase/migrations/` | Banco que já existia. Rode cada arquivo uma vez, em ordem de data, no SQL Editor ou com `npm run db:migrate -- arquivo.sql` dentro de `front/` (precisa de `DATABASE_URL` no `.env.local`). |

O `seed.sql` é gerado a partir de `front/src/lib/catalog-data.ts`: depois de mudar o catálogo de referência,
rode `npm run seed:sql` dentro de `front/`.

## Migrações

| Arquivo | Situação no banco atual |
|---|---|
| `2026-10-03_price_tiers.sql` | Aplicada em 04/10/2026. Desconto progressivo. |
| `2026-10-04_price_profiles.sql` | Aplicada em 04/10/2026. Perfis de preço de clientes preferenciais. |
| `2026-10-04_acabamento_unico_copias.sql` | Aplicada em 04/10/2026. Acabamento único e até 10.000 cópias por foto. |

Banco novo não precisa das migrações: o `schema.sql` e o `seed.sql` já trazem tudo.
