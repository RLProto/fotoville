import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { COUPON_CODE, endOfDayBrasilia } from "@/lib/coupon-rules";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().regex(COUPON_CODE),
  description: z.string().trim().max(200).optional(),
  percent: z.number().int().min(1).max(100),
  min_order_cents: z.number().int().min(0).max(10_000_000).default(0),
  /** Último dia de validade (AAAA-MM-DD), ou nada para sem validade. */
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max_uses: z.number().int().min(1).max(1_000_000).optional(),
  once_per_customer: z.boolean().default(false),
});

/** Cria um cupom de desconto percentual. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira o código (3 a 20 letras e números), o desconto (1 a 100%) e os limites.");
  const input = parsed.data;

  const expires_at = input.expires_on ? endOfDayBrasilia(input.expires_on) : null;
  if (expires_at && new Date(expires_at) <= new Date()) return fail("A validade já passou. Escolha hoje ou uma data futura.");

  const { error } = await createAdminClient()
    .from("coupons")
    .insert({
      code: input.code,
      kind: "percent",
      percent_off: input.percent,
      description: input.description || null,
      min_order_cents: input.min_order_cents,
      expires_at,
      max_uses: input.max_uses ?? null,
      once_per_customer: input.once_per_customer,
    });
  if (error?.code === "23505") return fail("Já existe um cupom com esse código.", 409);
  if (error) return serverFail("painel", "Não foi possível criar o cupom. Tente de novo.", error, 500, { cupom: input.code });
  return NextResponse.json({ code: input.code });
}
