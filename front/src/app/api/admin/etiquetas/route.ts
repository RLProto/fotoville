import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.strictObject({ ids: z.array(z.guid()).min(1).max(500) });

/** Marca as etiquetas destes pedidos como impressas: entraram num PDF. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Seleção inválida.");

  const { error } = await createAdminClient().rpc("mark_labels_printed", { p_ids: parsed.data.ids });
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "marcar etiquetas" });
  return NextResponse.json({ ok: true });
}
