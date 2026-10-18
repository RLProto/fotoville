import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, requireUser, serverFail } from "@/lib/api";
import { loadCartPhotos, summarizeCart } from "@/lib/cart";
import { getProducts } from "@/lib/catalog";
import { previewCoupon, recordCouponMiss, TOO_MANY_MISSES, tooManyCouponMisses } from "@/lib/coupons";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ code: z.string().min(1).max(40) });

/** Valida um cupom contra o carrinho atual e devolve o desconto. Não consome o cupom. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Digite o código do cupom.");

  const admin = createAdminClient();
  const ip = clientIp(request);
  if (await tooManyCouponMisses(admin, auth.user.id, ip)) return fail(TOO_MANY_MISSES, 429);

  const [photos, products] = await Promise.all([loadCartPhotos(auth.supabase, auth.user.id), getProducts()]);
  const cart = summarizeCart(photos, products);
  if (!cart.lines.length) return fail("Seu carrinho está vazio.");

  let result;
  try {
    result = await previewCoupon(admin, parsed.data.code, cart.lines, auth.user.id);
  } catch (err) {
    return serverFail("checkout", "Não foi possível conferir o cupom agora. Tente de novo.", err, 500, { etapa: "conferir cupom" });
  }
  if (!result.ok) {
    if (result.miss) await recordCouponMiss(admin, auth.user.id, ip);
    return fail(result.message, 422);
  }
  return NextResponse.json(result);
}
