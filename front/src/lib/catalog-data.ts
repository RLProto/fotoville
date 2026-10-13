import type { Finish, Package, PriceTier, Product } from "./types";

/**
 * Catálogo de referência: a tabela "Valores por unidade para Combo" da loja (2026), mais Mini Polaroid e Polaroid ímã.
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

/**
 * Tamanho de revelação. `nominal` é o nome comercial ("10x15"), o que o cliente vê;
 * `w` e `h` são a medida real do papel em cm, a que a impressora conhece. O recorte, a prévia
 * e o arquivo de impressão usam a medida real.
 */
function print(
  sort: number,
  nominal: string,
  w: number,
  h: number,
  price_cents: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id: nominal,
    name: `${nominal} cm`,
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

/** Medida comercial em cm ("10x15" -> [10, 15]). Para os demais produtos, a medida real. */
export function nominalCm(product: Pick<Product, "name" | "width_cm" | "height_cm">): [number, number] {
  const m = /^(\d+)x(\d+)/.exec(product.name);
  return m ? [Number(m[1]), Number(m[2])] : [product.width_cm, product.height_cm];
}

/** Medida real do papel no formato das pastas de impressão: "10,2x15,2". */
export function realSizeLabel(product: Pick<Product, "width_cm" | "height_cm">) {
  const cm = (v: number) => String(v).replace(".", ",");
  return `${cm(product.width_cm)}x${cm(product.height_cm)}`;
}

/** Nomes comerciais na primeira coluna; na chamada, a medida real do papel (tabela da impressora). */
export const PRODUCTS: Product[] = [
  print(10, "10x13", 10.2, 12.7, 199),
  print(20, "10x15", 10.2, 15.2, 199, { price_tiers: TIERS_10X15 }),
  print(30, "13x15", 12.7, 15.2, 209),
  print(40, "13x18", 12.7, 18, 500),
  print(50, "15x15", 15.2, 15.2, 329),
  print(60, "15x21", 15.2, 21.4, 399, { price_tiers: TIERS_15X21 }),
  print(80, "20x20", 20.3, 20.3, 499),
  print(90, "20x25", 20.3, 25.4, 599),
  print(100, "20x30", 20.3, 30.5, 849),
  print(120, "25x25", 25.4, 25.4, 749),
  print(130, "25x30", 25.4, 30.5, 869),
  print(140, "25x40", 25.4, 40, 1649),
  print(160, "25x50", 25.4, 50, 1769),
  print(170, "25x60", 25.4, 60, 2049),
  print(190, "30x30", 30.5, 30.5, 1589),
  print(210, "30x40", 30.5, 40, 1899),
  print(220, "30x45", 30.5, 45, 2099),
  print(230, "30x50", 30.5, 50, 2399),
  print(240, "30x60", 30.5, 60, 2659),
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
    // Papel 8,2 x 10,2 cm da impressora, com janela quadrada de 7 x 7 (moldura em INSTANT_FRAMES).
    id: "polaroid",
    name: "Polaroid",
    kind: "polaroid",
    width_cm: 8.2,
    height_cm: 10.2,
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
