import type { PriceTier, Product } from "./types";

type Priced = Pick<Product, "price_cents" | "price_tiers">;

/** Mínimo de fotos por pedido em alguns tamanhos (a Mini Polaroid sai em pares). Conta as cópias. */
export const MIN_COPIES: Record<string, number> = { "mini-polaroid": 2 };

export function minCopies(product: Pick<Product, "id">) {
  return MIN_COPIES[product.id] ?? 1;
}

/** Preço de tabela, antes de qualquer desconto: o da loja quando o cliente tem perfil, senão o do produto. */
export function regularPrice(product: Pick<Product, "price_cents" | "store">) {
  return product.store?.price_cents ?? product.price_cents;
}

/** Preço por foto conforme o total de cópias daquele tamanho no pedido. */
export function unitPrice(product: Priced, quantity: number) {
  let price = product.price_cents;
  for (const tier of product.price_tiers) {
    if (quantity >= tier.min && tier.price_cents < price) price = tier.price_cents;
  }
  return price;
}

/**
 * Faixas de um perfil de cliente nas mesmas quantidades da loja: o perfil só muda o preço de cada faixa.
 * Quantidade que o perfil não tinha recebe o preço que ele cobra nessa quantidade (pode ser igual à anterior).
 */
export function alignTiers(row: Priced, storeTiers: PriceTier[]): PriceTier[] {
  return storeTiers.map((t) => ({ min: t.min, price_cents: unitPrice(row, t.min) }));
}

/** Próxima faixa de desconto ainda não alcançada, ou null. */
export function nextTier(product: Priced, quantity: number): PriceTier | null {
  const current = unitPrice(product, quantity);
  return product.price_tiers.find((t) => t.min > quantity && t.price_cents < current) ?? null;
}

/** Próxima faixa, só quando o pedido já passou da metade do caminho até ela (evita "com mais 97..."). */
export function nearTier(product: Priced, quantity: number): PriceTier | null {
  const next = nextTier(product, quantity);
  return next && quantity * 2 >= next.min ? next : null;
}

/** Faixas de quantidade de um ou mais tamanhos, para a tabela: 1 a 99, 100 a 299, ..., 1000 ou mais. */
export function quantityRanges(products: Priced[]) {
  const starts = [...new Set([1, ...products.flatMap((p) => p.price_tiers.map((t) => t.min))])].sort((a, b) => a - b);
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : null }));
}

export function rangeLabel({ from, to }: { from: number; to: number | null }) {
  if (to === null) return `${from} ou mais`;
  return from === to ? String(from) : `${from} a ${to}`;
}

/** Limpa as faixas vindas do banco: inteiros válidos, ordenados pela quantidade. */
export function parseTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => ({ min: Number(t?.min), price_cents: Number(t?.price_cents) }))
    .filter((t) => Number.isInteger(t.min) && t.min > 1 && Number.isInteger(t.price_cents) && t.price_cents >= 0)
    .sort((a, b) => a.min - b.min);
}
