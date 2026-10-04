/**
 * Gera back/supabase/seed.sql a partir de src/lib/catalog-data.ts.
 * Uso: npm run seed:sql
 */
import { writeFileSync } from "node:fs";
import { PACKAGES, PRODUCTS } from "../src/lib/catalog-data.ts";

const q = (value: string | null) => (value === null ? "null" : `'${value.replace(/'/g, "''")}'`);
const n = (value: number | null) => (value === null ? "null" : String(value));

const products = PRODUCTS.map(
  (p) =>
    `  (${q(p.id)}, ${q(p.name)}, ${q(p.kind)}, ${p.width_cm}, ${p.height_cm}, ${p.price_cents}, '${JSON.stringify(p.price_tiers)}', '{${p.finishes.join(",")}}', ${n(p.unit_weight_g)}, ${n(p.unit_thickness_mm)}, ${p.sort})`,
).join(",\n");

const packages = PACKAGES.map(
  (p) => `  (${q(p.id)}, ${q(p.name)}, ${q(p.product_id)}, ${p.photo_count}, ${p.price_cents}, ${q(p.description)}, ${p.sort})`,
).join(",\n");

const sql = `-- Fotoville — catálogo inicial. Gerado por scripts/generate-seed.mts; não edite à mão.
-- Rode depois do schema.sql. Pode rodar de novo: atualiza nome, medidas e preço.

insert into public.products
  (id, name, kind, width_cm, height_cm, price_cents, price_tiers, finishes, unit_weight_g, unit_thickness_mm, sort)
values
${products}
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
${packages}
on conflict (id) do update set
  name = excluded.name,
  product_id = excluded.product_id,
  photo_count = excluded.photo_count,
  price_cents = excluded.price_cents,
  description = excluded.description,
  sort = excluded.sort;
`;

writeFileSync(new URL("../../back/supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql gerado: ${PRODUCTS.length} produtos, ${PACKAGES.length} pacotes.`);
