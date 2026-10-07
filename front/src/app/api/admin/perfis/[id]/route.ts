import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPriceRow, normalizePriceRow, priceRowsSchema } from "@/lib/admin-pricing";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { getStoreProducts } from "@/lib/catalog";
import { alignTiers } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  items: priceRowsSchema.optional(),
});

/**
 * Renomeia o perfil e grava a tabela de preços dele.
 * O perfil guarda só o que difere da loja: tamanho igual à loja perde a linha e passa a seguir a tabela da loja,
 * inclusive quando ela mudar depois.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Perfil não encontrado.", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira o nome e os valores: preço em reais e faixas a partir de 2 fotos.");
  const store = new Map((await getStoreProducts()).map((p) => [p.id, p]));
  // O perfil só muda o preço de cada faixa: as quantidades são sempre as da loja
  const items = (parsed.data.items ?? []).map(normalizePriceRow).map((row) => ({
    ...row,
    price_tiers: alignTiers(row, store.get(row.product_id)?.price_tiers ?? []),
  }));
  for (const row of items) {
    const problem = checkPriceRow(row, { allowEqual: true });
    if (problem) return fail(`${row.product_id}: ${problem}`);
  }

  const admin = createAdminClient();
  if (parsed.data.name) {
    const { error } = await admin.from("price_profiles").update({ name: parsed.data.name }).eq("id", id);
    if (error) return serverFail("painel", "Não foi possível renomear o perfil. Tente de novo.", error, 500, { profile: id });
  }
  if (items.length) {
    const sameAsStore = items.filter((row) => {
      const s = store.get(row.product_id);
      return s && s.price_cents === row.price_cents && JSON.stringify(s.price_tiers) === JSON.stringify(row.price_tiers);
    });
    const own = items.filter((row) => !sameAsStore.includes(row)).map((row) => ({ profile_id: id, ...row }));
    if (own.length) {
      const { error } = await admin.from("profile_prices").upsert(own);
      if (error) return serverFail("painel", "Não foi possível salvar os preços do perfil. Tente de novo.", error, 500, { profile: id });
    }
    if (sameAsStore.length) {
      const { error } = await admin
        .from("profile_prices")
        .delete()
        .eq("profile_id", id)
        .in("product_id", sameAsStore.map((r) => r.product_id));
      if (error) return serverFail("painel", "Não foi possível salvar os preços do perfil. Tente de novo.", error, 500, { profile: id });
    }
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
