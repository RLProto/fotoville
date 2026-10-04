import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "./cart";
import { plural } from "./format";
import type { Coupon } from "./types";

export type CouponResult =
  | { ok: true; code: string; kind: Coupon["kind"]; discount_cents: number; credits: number; message: string }
  | { ok: false; message: string };

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Calcula o desconto de um cupom sobre o carrinho, sem consumir nada. */
export async function previewCoupon(admin: SupabaseClient, rawCode: string, lines: CartLine[]): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: "Digite o código do cupom." };

  const { data } = await admin.from("coupons").select("*").eq("code", code).maybeSingle();
  const coupon = data as Coupon | null;

  if (!coupon || !coupon.active) return { ok: false, message: "Cupom não encontrado." };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, message: "Este cupom expirou." };
  }

  if (coupon.kind === "percent") {
    const subtotal = lines.reduce((sum, l) => sum + l.total_cents, 0);
    const discount_cents = Math.floor((subtotal * (coupon.percent_off ?? 0)) / 100);
    return {
      ok: true,
      code,
      kind: "percent",
      discount_cents,
      credits: 0,
      message: `${coupon.percent_off}% de desconto nas fotos.`,
    };
  }

  const balance = coupon.credits_total - coupon.credits_used;
  if (balance <= 0) return { ok: false, message: "Este cupom já foi todo utilizado." };

  const eligible = lines.filter((l) => l.product.id === coupon.product_id);
  if (!eligible.length) {
    return { ok: false, message: `Este cupom vale para fotos ${coupon.product_id}. Não há nenhuma no carrinho.` };
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
    credits,
    message: `${plural(credits, "foto coberta", "fotos cobertas")} pelo cupom. Saldo depois deste pedido: ${remaining}.`,
  };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I

export function generateCouponCode() {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `FV-${block()}-${block()}`;
}
