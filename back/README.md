# Banco (Supabase)

O site não tem servidor próprio: o banco, o login e as fotos ficam no Supabase. Esta pasta guarda a estrutura
do banco. Tudo se roda no **SQL Editor** do painel do Supabase.

| Arquivo | Quando rodar |
|---|---|
| `supabase/schema.sql` | Banco novo. Cria tabelas, regras de acesso (RLS) e funções. Pode rodar de novo sem perder dados. |
| `supabase/seed.sql` | Depois do schema. Carrega tamanhos, preços e pacotes. Rodar de novo **sobrescreve** os preços. |
| `supabase/migrations/` | Banco que já existia. Rode cada arquivo uma vez, em ordem de data. |

O `seed.sql` é gerado a partir de `front/src/lib/catalog-data.ts`: depois de mudar o catálogo de referência,
rode `npm run seed:sql` dentro de `front/`.

## Migrações

| Arquivo | Situação no banco atual |
|---|---|
| `2026-10-03_price_tiers.sql` | **Pendente.** Desconto por quantidade. Até rodar, o site usa as faixas do código. |

Banco novo não precisa das migrações: o `schema.sql` e o `seed.sql` já trazem tudo.
