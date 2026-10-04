import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const resolveSchema = z.object({
  scope: z.string().min(1).max(40),
  message: z.string().min(1).max(1000),
});

/** Marca como resolvidas todas as ocorrências abertas de um erro (mesma área e mensagem). */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = resolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Erro não identificado.");

  const { error, count } = await createAdminClient()
    .from("error_logs")
    .update({ resolved_at: new Date().toISOString() }, { count: "exact" })
    .eq("scope", parsed.data.scope)
    .eq("message", parsed.data.message)
    .is("resolved_at", null);
  if (error) return serverFail("painel", error.message, error, 500, { etapa: "resolver erro" });
  return NextResponse.json({ resolved: count ?? 0 });
}
