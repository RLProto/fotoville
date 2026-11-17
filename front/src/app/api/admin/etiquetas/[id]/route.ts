import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { loadBatchLabels } from "@/lib/label-batches";
import { createAdminClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** Etiquetas do lote, atualizadas na hora de imprimir. */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!z.guid().safeParse(id).success) return fail("Lote inválido.");
  try {
    const labels = await loadBatchLabels(createAdminClient(), id);
    if (!labels) return fail("Lote não encontrado.", 404);
    return NextResponse.json({ labels });
  } catch (err) {
    return serverFail("painel", "Erro ao carregar etiquetas do lote", err, 500, { lote: id });
  }
}

/** Desfaz o lote antes da primeira impressão: os pedidos voltam para a fila. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!z.guid().safeParse(id).success) return fail("Lote inválido.");
  const { data, error } = await createAdminClient().rpc("undo_label_batch", { p_batch: id });
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "desfazer lote", lote: id });
  if (!data) return fail("Este lote já foi impresso.", 409);
  return NextResponse.json({ ok: true });
}
