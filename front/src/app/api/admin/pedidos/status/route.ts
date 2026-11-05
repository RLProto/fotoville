import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { BULK_STATUSES } from "@/lib/order-rules";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.strictObject({ ids: z.array(z.guid()).min(1).max(500), status: z.enum(BULK_STATUSES) });

/** Muda o status de vários pedidos. Responde quais mudaram: quem não pode ir para esse status não muda. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Seleção inválida.");
  const { ids, status } = parsed.data;

  const { data, error } = await createAdminClient().rpc("bulk_order_status", { p_ids: ids, p_status: status });
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "status em massa", status });
  return NextResponse.json({ updated: (data as { id: string }[]).map((row) => row.id) });
}
