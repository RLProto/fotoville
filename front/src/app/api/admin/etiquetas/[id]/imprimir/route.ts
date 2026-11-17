import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * O lote foi para a impressão: marca as etiquetas como impressas e passa os pedidos aprovados para "Em produção".
 * Devolve quantos mudaram de status (reimprimir não muda nenhum).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!z.guid().safeParse(id).success) return fail("Lote inválido.");
  const { data, error } = await createAdminClient().rpc("print_label_batch", { p_batch: id });
  if (error?.code === "P0002") return fail("Lote não encontrado.", 404);
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "imprimir lote", lote: id });
  return NextResponse.json({ moved: (data ?? []).length });
}
