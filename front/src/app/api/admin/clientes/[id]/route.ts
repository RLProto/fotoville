import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const schema = z.object({ profile_id: z.string().regex(UUID).nullable() });

/** Define o perfil de preço de um cliente (null = volta para a tabela da loja). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Cliente não encontrado.", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Perfil inválido.");

  const admin = createAdminClient();
  const { error } = parsed.data.profile_id
    ? await admin
        .from("customer_price_profiles")
        .upsert({ user_id: id, profile_id: parsed.data.profile_id, assigned_at: new Date().toISOString() })
    : await admin.from("customer_price_profiles").delete().eq("user_id", id);
  if (error) return serverFail("painel", "Não foi possível salvar o perfil do cliente. Tente de novo.", error, 500, { user: id });
  return NextResponse.json({ ok: true });
}
