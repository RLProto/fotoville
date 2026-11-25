import { NextResponse } from "next/server";
import { deleteOrderPhotos, loadOrderDownload } from "@/lib/admin-orders";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { DELETABLE } from "@/lib/order-rules";
import { hasStorage } from "@/lib/storage";
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
 * apagar o que ainda não foi baixado.
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

  let deleted: number;
  try {
    deleted = await deleteOrderPhotos(admin, id);
  } catch (err) {
    return serverFail("painel", "Não foi possível apagar as imagens. Tente de novo.", err, 500, { order: id });
  }
  return NextResponse.json({ ok: true, deleted });
}
