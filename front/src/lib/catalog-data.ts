import type { Finish, Package, PriceTier, Product } from "./types";

/**
 * Catálogo de referência, copiado do site atual (fotoville.com.br) em out/2026.
 * É a fonte do back/supabase/seed.sql e o fallback quando o Supabase não está configurado.
 * Em produção, os preços valem pelo banco: edite a tabela `products`.
 */

/** Acabamento único. Não aparece no site; fica só nos dados do pedido. */
const FINISH: Finish[] = ["brilho"];

/** Desconto progressivo, da tabela "Valores por unidade para Combo" da loja (2026). */
const TIERS_10X15: PriceTier[] = [
  { min: 20, price_cents: 179 },
  { min: 50, price_cents: 169 },
  { min: 100, price_cents: 119 },
  { min: 300, price_cents: 109 },
  { min: 500, price_cents: 99 },
];
const TIERS_15X21: PriceTier[] = [
  { min: 20, price_cents: 389 },
  { min: 50, price_cents: 379 },
  { min: 100, price_cents: 349 },
  { min: 300, price_cents: 329 },
  { min: 500, price_cents: 309 },
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
    finishes: FINISH,
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
  print(40, 13, 18, 500),
  print(50, 15, 15, 329),
  print(60, 15, 21, 399, { price_tiers: TIERS_15X21 }),
  print(70, 15, 30, 659),
  print(80, 20, 20, 499),
  print(90, 20, 25, 599),
  print(100, 20, 30, 849),
  print(110, 20, 45, 1299),
  print(120, 25, 25, 749),
  print(130, 25, 30, 869),
  print(140, 25, 40, 1649),
  print(150, 25, 45, 1549),
  print(160, 25, 50, 1769),
  print(170, 25, 60, 2049),
  print(180, 28, 35, 2000),
  print(190, 30, 30, 1589),
  print(200, 30, 35, 1599),
  print(210, 30, 40, 1899),
  print(220, 30, 45, 2099),
  print(230, 30, 50, 2399),
  print(240, 30, 60, 2659),
  {
    // Formato do filme Instax Mini (5,4 x 8,6 cm, imagem 4,6 x 6,2). Pedido mínimo de 2 fotos (MIN_COPIES).
    // Preço provisório: confirmar com a loja.
    id: "mini-polaroid",
    name: "Mini Polaroid",
    kind: "polaroid",
    width_cm: 5.4,
    height_cm: 8.6,
    price_cents: 350,
    price_tiers: [],
    finishes: FINISH,
    unit_weight_g: null,
    unit_thickness_mm: null,
    sort: 295,
    active: true,
  },
  {
    // Formato do filme Polaroid 600/i-Type (8,8 x 10,7 cm, imagem 7,9 x 7,9).
    id: "polaroid",
    name: "Polaroid",
    kind: "polaroid",
    width_cm: 8.8,
    height_cm: 10.7,
    price_cents: 450,
    price_tiers: [],
    finishes: FINISH,
    unit_weight_g: null,
    unit_thickness_mm: null,
    sort: 300,
    active: true,
  },
  {
    // Polaroid com ímã atrás, mesma medida da Polaroid. Peso do ímã estimado: confirmar com a loja.
    id: "polaroid-ima",
    name: "Polaroid ímã",
    kind: "polaroid",
    width_cm: 8.8,
    height_cm: 10.7,
    price_cents: 750,
    price_tiers: [],
    finishes: FINISH,
    unit_weight_g: 20,
    unit_thickness_mm: 1.5,
    sort: 305,
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
    finishes: FINISH,
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
  description: "Compre agora e revele quando quiser.",
  sort: (i + 1) * 10,
  active: true,
}));
