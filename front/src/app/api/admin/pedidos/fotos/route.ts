import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOrderPhotos } from "@/lib/admin-orders";
import { fail, reportServerError, requireAdmin, serverFail } from "@/lib/api";
import { DELETABLE } from "@/lib/order-rules";
import { hasStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const schema = z.strictObject({ ids: z.array(z.guid()).min(1).max(500) });
const PARALLEL = 4;

/**
 * Apaga as imagens de vários pedidos. Só de quem está enviado, pronto para retirada, entregue ou cancelado e ainda
 * tem imagens; os outros ficam como estão. Responde os pedidos apagados e os que falharam.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (!hasStorage) return fail("Armazenamento não configurado.", 503);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Seleção inválida.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, number")
    .in("id", parsed.data.ids)
    .eq("kind", "prints")
    .in("status", DELETABLE)
    .is("photos_deleted_at", null);
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "apagar imagens em massa" });

  const queue = [...(data ?? [])];
  const deleted: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let order = queue.shift(); order; order = queue.shift()) {
        try {
          await deleteOrderPhotos(admin, order.id);
          deleted.push(order.id);
        } catch (err) {
          failed.push(order.id);
          reportServerError("painel", err, { etapa: "apagar imagens em massa", order: order.number });
        }
      }
    }),
  );
  return NextResponse.json({ deleted, failed });
}
