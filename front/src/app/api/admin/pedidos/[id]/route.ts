import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { markOrderPaid } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z
    .enum(["pending", "paid", "in_production", "shipped", "ready_for_pickup", "delivered", "cancelled"])
    .optional(),
  tracking_code: z.string().trim().max(40).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Alteração inválida.");
  const { status, tracking_code } = parsed.data;

  const admin = createAdminClient();

  // Marcar como pago manualmente passa pelo mesmo caminho do webhook (gera cupom de pacote).
  if (status === "paid") {
    await markOrderPaid(admin, id, { id: null, method: "manual" });
  }

  const patch: Record<string, unknown> = {};
  if (status && status !== "paid") patch.status = status;
  if (tracking_code !== undefined) patch.tracking_code = tracking_code || null;

  if (Object.keys(patch).length) {
    const { error } = await admin.from("orders").update(patch).eq("id", id);
    if (error) return serverFail("painel", error.message, error, 500, { order: id });
  }
  return NextResponse.json({ ok: true });
}
