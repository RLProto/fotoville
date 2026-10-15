import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { COUPON_CODE } from "@/lib/coupon-rules";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ active: z.boolean() });

/** Habilita ou desabilita um cupom. Pedidos que já usaram o cupom não mudam. */
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { code } = await params;
  if (!COUPON_CODE.test(code)) return fail("Cupom não encontrado.", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Pedido inválido.");

  const { data, error } = await createAdminClient()
    .from("coupons")
    .update({ active: parsed.data.active })
    .eq("code", code)
    .eq("kind", "percent")
    .select("code")
    .maybeSingle();
  if (error) return serverFail("painel", "Não foi possível alterar o cupom. Tente de novo.", error, 500, { cupom: code });
  if (!data) return fail("Cupom não encontrado.", 404);
  return NextResponse.json({ ok: true });
}
