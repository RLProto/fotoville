import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "./cart";
import { percentDiscount } from "./coupon-rules";
import { formatBRL, formatDate, plural } from "./format";
import type { Coupon } from "./types";

/**
 * Cupom que vale. `discount_cents` do cupom percentual cobre só as fotos: o desconto final inclui o frete,
 * que o checkout soma com `percent_off` quando a entrega está escolhida.
 */
export type CouponResult =
  | {
      ok: true;
      code: string;
      kind: Coupon["kind"];
      discount_cents: number;
      percent_off: number | null;
      credits: number;
      message: string;
    }
  | { ok: false; message: string };

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Respostas de `coupon_problem` no banco: por que o cupom percentual não vale. */
export type CouponProblem = "not_found" | "inactive" | "expired" | "min_order" | "limit" | "customer";

/** Mensagem para o cliente quando o cupom não vale. */
export function couponProblemMessage(problem: CouponProblem, coupon: Coupon | null): string {
  switch (problem) {
    case "inactive":
      return "Este cupom não está mais disponível.";
    case "expired":
      return coupon?.expires_at ? `Este cupom expirou em ${formatDate(coupon.expires_at)}.` : "Este cupom expirou.";
    case "min_order":
      return `Este cupom vale a partir de ${formatBRL(coupon?.min_order_cents ?? 0)} em fotos.`;
    case "limit":
      return "Este cupom já atingiu o limite de usos.";
    case "customer":
      return "Você já usou este cupom.";
    default:
      return "Cupom não encontrado. Confira o código.";
  }
}

/** Calcula o desconto de um cupom sobre o carrinho do cliente, sem consumir nada. */
export async function previewCoupon(
  admin: SupabaseClient,
  rawCode: string,
  lines: CartLine[],
  userId: string,
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: "Digite o código do cupom." };

  const { data } = await admin.from("coupons").select("*").eq("code", code).maybeSingle();
  const coupon = data as Coupon | null;

  if (!coupon) return { ok: false, message: couponProblemMessage("not_found", null) };

  if (coupon.kind === "percent") {
    const subtotal = lines.reduce((sum, l) => sum + l.total_cents, 0);
    // Mesmas regras que o checkout confere ao registrar o uso (validade, mínimo, limite, uma vez por cliente)
    const { data: problem, error } = await admin.rpc("coupon_problem", { p_code: code, p_user: userId, p_subtotal: subtotal });
    if (error) throw error;
    if (problem) return { ok: false, message: couponProblemMessage(problem as CouponProblem, coupon) };
    const percent_off = coupon.percent_off ?? 0;
    return {
      ok: true,
      code,
      kind: "percent",
      discount_cents: percentDiscount(subtotal, percent_off),
      percent_off,
      credits: 0,
      message: `${percent_off}% de desconto no pedido, frete incluído.`,
    };
  }

  if (!coupon.active) return { ok: false, message: couponProblemMessage("not_found", null) };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, message: couponProblemMessage("expired", coupon) };
  }

  const balance = coupon.credits_total - coupon.credits_used;
  if (balance <= 0) return { ok: false, message: "Este cupom não tem mais saldo." };

  const eligible = lines.filter((l) => l.product.id === coupon.product_id);
  if (!eligible.length) {
    return { ok: false, message: `Este cupom vale para fotos ${coupon.product_id}. Adicione fotos ${coupon.product_id} ao carrinho.` };
  }

  let remaining = balance;
  let discount_cents = 0;
  for (const line of eligible) {
    const used = Math.min(remaining, line.quantity);
    discount_cents += used * line.unit_price_cents;
    remaining -= used;
  }
  const credits = balance - remaining;

  return {
    ok: true,
    code,
    kind: "credits",
    discount_cents,
    percent_off: null,
    credits,
    message: `Cobre ${plural(credits, "foto", "fotos")}. Saldo depois deste pedido: ${plural(remaining, "foto", "fotos")}.`,
  };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I

export function generateCouponCode() {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `FV-${block()}-${block()}`;
}
