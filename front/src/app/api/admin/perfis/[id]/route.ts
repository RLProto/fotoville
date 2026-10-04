import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPriceRow, normalizePriceRow, priceRowsSchema } from "@/lib/admin-pricing";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  items: priceRowsSchema.optional(),
});

/** Renomeia o perfil e grava a tabela de preços dele. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Perfil não encontrado.", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira o nome e os valores: preço em reais e faixas a partir de 2 fotos.");
  for (const row of parsed.data.items ?? []) {
    const problem = checkPriceRow(row);
    if (problem) return fail(`${row.product_id}: ${problem}`);
  }

  const admin = createAdminClient();
  if (parsed.data.name) {
    const { error } = await admin.from("price_profiles").update({ name: parsed.data.name }).eq("id", id);
    if (error) return serverFail("painel", "Não foi possível renomear o perfil. Tente de novo.", error, 500, { profile: id });
  }
  if (parsed.data.items?.length) {
    const rows = parsed.data.items.map(normalizePriceRow).map((row) => ({ profile_id: id, ...row }));
    const { error } = await admin.from("profile_prices").upsert(rows);
    if (error) return serverFail("painel", "Não foi possível salvar os preços do perfil. Tente de novo.", error, 500, { profile: id });
  }
  return NextResponse.json({ ok: true });
}

/** Exclui o perfil. Os clientes dele voltam para a tabela da loja. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Perfil não encontrado.", 404);

  const { error } = await createAdminClient().from("price_profiles").delete().eq("id", id);
  if (error) return serverFail("painel", "Não foi possível excluir o perfil. Tente de novo.", error, 500, { profile: id });
  return NextResponse.json({ ok: true });
}
