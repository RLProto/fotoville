import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireUser } from "@/lib/api";
import { loadCartPhotos, summarizeCart } from "@/lib/cart";
import { getProducts } from "@/lib/catalog";
import { previewCoupon } from "@/lib/coupons";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ code: z.string().min(1).max(40) });

/** Valida um cupom contra o carrinho atual e devolve o desconto. Não consome o cupom. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Digite o código do cupom.");

  const [photos, products] = await Promise.all([loadCartPhotos(auth.supabase, auth.user.id), getProducts()]);
  const cart = summarizeCart(photos, products);
  if (!cart.lines.length) return fail("Seu carrinho está vazio.");

  const result = await previewCoupon(createAdminClient(), parsed.data.code, cart.lines);
  if (!result.ok) return fail(result.message, 422);
  return NextResponse.json(result);
}
