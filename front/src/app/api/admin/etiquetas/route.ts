import { NextResponse } from "next/server";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

/** Gera um lote de etiquetas com todos os pedidos aprovados que ainda não estão em lote. */
export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { data, error } = await createAdminClient().rpc("create_label_batch", { p_user: auth.user.id });
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "gerar lote de etiquetas" });

  const batch = (data as { id: string; number: number; orders: number }[] | null)?.[0];
  if (!batch) return fail("Nenhum pedido aprovado aguardando etiqueta.", 409);
  return NextResponse.json({ batch });
}
