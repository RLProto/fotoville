import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { districtKey } from "@/lib/shipping/district";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  zones: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        district: z.string().trim().min(2).max(60),
        price_cents: z.number().int().min(0).max(100000),
        active: z.boolean(),
      }),
    )
    .max(200),
});

/** Grava a lista inteira de bairros do motoboy: cria, atualiza e apaga o que saiu da lista. */
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira os bairros: nome com 2 a 60 letras e preço em reais.");

  const rows = parsed.data.zones.map((z) => ({ ...z, district_key: districtKey(z.district) }));
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.district_key) return fail(`Bairro inválido: "${row.district}".`);
    if (seen.has(row.district_key)) return fail(`Bairro repetido: ${row.district}.`);
    seen.add(row.district_key);
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.from("motoboy_zones").select("id");
  if (readError) return serverFail("painel", "Não foi possível ler os bairros.", readError, 500);
  const keep = new Set(rows.map((r) => r.id).filter(Boolean));
  const gone = (current ?? []).map((r) => r.id).filter((id) => !keep.has(id));

  if (gone.length) {
    const { error } = await admin.from("motoboy_zones").delete().in("id", gone);
    if (error) return serverFail("painel", "Não foi possível remover bairros.", error, 500);
  }
  if (rows.length) {
    const { error } = await admin
      .from("motoboy_zones")
      .upsert(rows.map(({ id, ...r }) => (id ? { id, ...r } : r)), { onConflict: "id" });
    if (error) return serverFail("painel", "Não foi possível salvar os bairros. Tente de novo.", error, 500);
  }
  return NextResponse.json({ ok: true });
}
