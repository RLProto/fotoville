import { NextResponse } from "next/server";
import { z } from "zod";
import { discountRow } from "@/lib/admin-pricing";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { getStoreProducts } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  percent: z.number().min(0).max(90).default(0),
});

/** Cria um perfil já com a tabela da loja copiada (com o desconto inicial, se houver). */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Dê um nome ao perfil (até 60 letras) e um desconto entre 0 e 90%.");

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("price_profiles")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();
  if (error || !profile) return serverFail("painel", "Não foi possível criar o perfil. Tente de novo.", error);

  const rows = (await getStoreProducts()).map((p) => ({
    profile_id: profile.id,
    ...discountRow({ product_id: p.id, price_cents: p.price_cents, price_tiers: p.price_tiers }, parsed.data.percent),
  }));
  const { error: rowsError } = await admin.from("profile_prices").insert(rows);
  if (rowsError) {
    await admin.from("price_profiles").delete().eq("id", profile.id);
    return serverFail("painel", "Não foi possível criar a tabela do perfil. Tente de novo.", rowsError);
  }
  return NextResponse.json({ id: profile.id });
}
