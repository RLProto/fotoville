import { NextResponse } from "next/server";
import { loadOrderDownload } from "@/lib/admin-orders";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { DELETABLE } from "@/lib/order-rules";
import { deleteObjects, hasStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Fotos do pedido com URLs assinadas, para o download em pastas a partir da lista de pedidos. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!data) return fail("Pedido não encontrado.", 404);
  return NextResponse.json(await loadOrderDownload(admin, data as Order));
}

/**
 * Apaga as imagens do pedido do bucket. Só para pedido já produzido (ou cancelado), para não
 * apagar o que ainda não foi baixado. As linhas de `photos` ficam, como histórico.
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (!hasStorage) return fail("Armazenamento não configurado.", 503);

  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!data) return fail("Pedido não encontrado.", 404);
  const order = data as Order;
  if (order.photos_deleted_at) return NextResponse.json({ ok: true, deleted: 0 });
  if (!DELETABLE.includes(order.status)) return fail("Só depois de o pedido entrar em produção.", 409);

  const { data: photos } = await admin.from("photos").select("storage_key, thumb_key").eq("order_id", id);
  const keys = (photos ?? []).flatMap((p) => [p.storage_key, p.thumb_key]).filter((k): k is string => Boolean(k));
  try {
    // O S3 aceita até 1.000 chaves por chamada
    for (let i = 0; i < keys.length; i += 1000) await deleteObjects(keys.slice(i, i + 1000));
  } catch (err) {
    return serverFail("painel", "Não foi possível apagar as imagens. Tente de novo.", err, 500, { order: id });
  }
  const { error } = await admin.from("orders").update({ photos_deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return serverFail("painel", error.message, error, 500, { order: id });
  return NextResponse.json({ ok: true, deleted: keys.length });
}
