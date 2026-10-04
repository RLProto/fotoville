import type { Finish, Package, PriceTier, Product } from "./types";

/**
 * Catálogo de referência, copiado do site atual (fotoville.com.br) em out/2026.
 * É a fonte do back/supabase/seed.sql e o fallback quando o Supabase não está configurado.
 * Em produção, os preços valem pelo banco: edite a tabela `products`.
 */

const BOTH: Finish[] = ["brilho", "fosco"];

/**
 * Desconto por quantidade do 10x15. O site antigo não tinha faixas, só os pacotes pré-pagos;
 * as faixas usam o preço por foto de cada pacote (100, 300, 500 e 1000 fotos).
 */
const TIERS_10X15: PriceTier[] = [
  { min: 100, price_cents: 119 },
  { min: 300, price_cents: 109 },
  { min: 500, price_cents: 99 },
  { min: 1000, price_cents: 89 },
];

function print(
  sort: number,
  w: number,
  h: number,
  price_cents: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id: `${w}x${h}`,
    name: `${w}x${h} cm`,
    kind: "print",
    width_cm: w,
    height_cm: h,
    price_cents,
    price_tiers: [],
    finishes: BOTH,
    unit_weight_g: null,
    unit_thickness_mm: null,
    sort,
    active: true,
    ...extra,
  };
}

export const PRODUCTS: Product[] = [
  print(10, 10, 13, 199),
  print(20, 10, 15, 199, { price_tiers: TIERS_10X15 }),
  print(30, 13, 15, 209),
  print(40, 13, 18, 500, { name: "13x18 cm Fosco", finishes: ["fosco"] }),
  print(50, 15, 15, 329),
  print(60, 15, 21, 399),
  print(70, 15, 30, 659),
  print(80, 20, 20, 499),
  print(90, 20, 25, 599),
  print(100, 20, 30, 849),
  print(110, 20, 45, 1299),
  print(120, 25, 25, 749),
  print(130, 25, 30, 869),
  print(140, 25, 40, 1499),
  print(150, 25, 45, 1549),
  print(160, 25, 50, 1599),
  print(170, 25, 60, 1869),
  print(180, 28, 35, 2000),
  print(190, 30, 30, 1589),
  print(200, 30, 35, 1599),
  print(210, 30, 40, 1899),
  print(220, 30, 45, 2099),
  print(230, 30, 50, 2399),
  print(240, 30, 60, 2659),
  {
    id: "polaroid",
    name: "Polaroid",
    kind: "polaroid",
    // Medida estimada do formato com borda. Confirmar com a loja.
    width_cm: 9,
    height_cm: 11,
    price_cents: 450,
    price_tiers: [],
    finishes: BOTH,
    unit_weight_g: null,
    unit_thickness_mm: null,
    sort: 300,
    active: true,
  },
  {
    id: "foto-placa-20x30",
    name: "Foto-placa 20x30 cm",
    kind: "placa",
    width_cm: 20,
    height_cm: 30,
    price_cents: 2000,
    price_tiers: [],
    finishes: BOTH,
    // Placa rígida: peso e espessura estimados. Confirmar com a loja.
    unit_weight_g: 380,
    unit_thickness_mm: 4,
    sort: 310,
    active: true,
  },
];

export const PACKAGES: Package[] = [
  { count: 100, price: 11900 },
  { count: 300, price: 32700 },
  { count: 500, price: 49500 },
  { count: 1000, price: 89000 },
].map(({ count, price }, i) => ({
  id: `pacote-${count}`,
  name: `${count} fotos 10x15`,
  product_id: "10x15",
  photo_count: count,
  price_cents: price,
  description: "Papel fotográfico. Compre agora e revele quando quiser.",
  sort: (i + 1) * 10,
  active: true,
}));
