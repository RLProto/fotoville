import { NextResponse } from "next/server";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

/** Tira o acesso ao painel. Ninguém remove a si mesmo, e o super admin não sai por aqui. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Conta não encontrada.", 404);
  if (id === auth.user.id) return fail("Você não pode remover o próprio acesso.", 403);

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("is_admin, is_super_admin").eq("id", id).maybeSingle();
  if (!target?.is_admin) return fail("Essa conta não é admin.", 404);
  if (target.is_super_admin) return fail("Essa conta não pode ser removida.", 403);

  const { error } = await admin.from("profiles").update({ is_admin: false }).eq("id", id);
  if (error) return serverFail("painel", "Não foi possível remover. Tente de novo.", error, 500, { user: id });
  return NextResponse.json({ ok: true });
}
