import "server-only";
import { z } from "zod";
import type { PriceRow } from "./types";

const tier = z.object({
  min: z.number().int().min(2).max(100000),
  price_cents: z.number().int().min(0).max(1_000_000),
});

export const priceRowSchema = z.object({
  product_id: z.string().min(1).max(60),
  price_cents: z.number().int().min(0).max(1_000_000),
  price_tiers: z.array(tier).max(10),
});

export const priceRowsSchema = z.array(priceRowSchema).max(200);

/**
 * Confere uma linha da tabela: faixas em ordem crescente, sem quantidade repetida e mais baratas que a anterior.
 * No perfil de cliente (`allowEqual`) a faixa pode repetir o preço anterior, porque as quantidades são as da loja.
 */
export function checkPriceRow(row: PriceRow, { allowEqual = false } = {}): string | null {
  const tiers = [...row.price_tiers].sort((a, b) => a.min - b.min);
  for (let i = 0; i < tiers.length; i++) {
    if (i > 0 && tiers[i].min === tiers[i - 1].min) return `Faixa repetida: ${tiers[i].min} fotos.`;
    const before = i === 0 ? row.price_cents : tiers[i - 1].price_cents;
    if (tiers[i].price_cents > before) return `A faixa de ${tiers[i].min} fotos não pode custar mais que a anterior.`;
    if (!allowEqual && tiers[i].price_cents === before) return `A faixa de ${tiers[i].min} fotos precisa ser mais barata que a anterior.`;
  }
  return null;
}

/** Linha pronta para gravar: faixas ordenadas. */
export function normalizePriceRow(row: PriceRow): PriceRow {
  return { ...row, price_tiers: [...row.price_tiers].sort((a, b) => a.min - b.min) };
}

/** Aplica um desconto percentual a uma linha (preço e faixas), arredondando ao centavo. */
export function discountRow(row: PriceRow, percent: number): PriceRow {
  const f = (cents: number) => Math.round((cents * (100 - percent)) / 100);
  return {
    product_id: row.product_id,
    price_cents: f(row.price_cents),
    price_tiers: row.price_tiers.map((t) => ({ min: t.min, price_cents: f(t.price_cents) })),
  };
}
