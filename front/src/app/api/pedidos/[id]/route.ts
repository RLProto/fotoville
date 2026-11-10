import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireUser, serverFail } from "@/lib/api";
import { customerCanEditNote, normalizeNote, noteProblem } from "@/lib/order-note";
import { createAdminClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

const schema = z.strictObject({ note: z.string().max(200) });

/** O cliente dá ou muda a descrição do próprio pedido, até a etiqueta ser impressa. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Alteração inválida.");
  const note = normalizeNote(parsed.data.note);
  const problem = noteProblem(note);
  if (problem) return fail(problem);

  // RLS: só o dono enxerga o pedido
  const { data } = await auth.supabase
    .from("orders")
    .select("kind, status, label_printed_at")
    .eq("id", id)
    .maybeSingle();
  const order = data as Pick<Order, "kind" | "status" | "label_printed_at"> | null;
  if (!order) return fail("Pedido não encontrado.", 404);
  if (!customerCanEditNote(order)) return fail("A etiqueta deste pedido já foi impressa.", 409);

  // A mesma regra na gravação: a etiqueta pode ter saído entre a leitura e aqui
  const { data: updated, error } = await createAdminClient()
    .from("orders")
    .update({ note })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("kind", "prints")
    .is("label_printed_at", null)
    .in("status", ["pending", "paid", "in_production"])
    .select("id");
  if (error) return serverFail("pedido", "Não foi possível salvar.", error, 500, { order: id });
  if (!updated?.length) return fail("A etiqueta deste pedido já foi impressa.", 409);
  return NextResponse.json({ note });
}
