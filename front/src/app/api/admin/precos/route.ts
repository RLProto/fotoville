import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPriceRow, normalizePriceRow, priceRowsSchema } from "@/lib/admin-pricing";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ items: priceRowsSchema.min(1) });

/** Grava preço e desconto progressivo da tabela da loja. */
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira os valores: preço em reais e faixas a partir de 2 fotos.");
  for (const row of parsed.data.items) {
    const problem = checkPriceRow(row);
    if (problem) return fail(`${row.product_id}: ${problem}`);
  }

  const admin = createAdminClient();
  const results = await Promise.all(
    parsed.data.items.map(normalizePriceRow).map((row) =>
      admin
        .from("products")
        .update({ price_cents: row.price_cents, price_tiers: row.price_tiers })
        .eq("id", row.product_id),
    ),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return serverFail("painel", "Não foi possível salvar os preços. Tente de novo.", error, 500, { etapa: "preços da loja" });
  return NextResponse.json({ ok: true });
}
