import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ user_id: z.string().regex(/^[0-9a-f-]{36}$/i) });

/** Dá acesso ao painel para uma conta do site. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Conta inválida.");
  const id = parsed.data.user_id;

  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.getUserById(id);
  if (!user?.user) return fail("Conta não encontrada.", 404);

  const { data: current } = await admin.from("profiles").select("is_admin").eq("id", id).maybeSingle();
  if (current?.is_admin) return fail("Essa conta já é admin.", 409);

  const { error } = await admin.from("profiles").upsert({ id, is_admin: true });
  if (error) return serverFail("painel", "Não foi possível adicionar. Tente de novo.", error, 500, { user: id });
  return NextResponse.json({ ok: true });
}
