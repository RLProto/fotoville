import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireAdmin, serverFail } from "@/lib/api";
import { findUserByEmail } from "@/lib/admin-team";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().pipe(z.email().max(200)) });

/** Dá acesso ao painel para uma conta já criada no site. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Informe um e-mail válido.");

  try {
    const user = await findUserByEmail(parsed.data.email);
    if (!user) return fail("Nenhuma conta com esse e-mail. A pessoa precisa criar a conta no site primeiro.", 404);

    const admin = createAdminClient();
    const { data: current } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (current?.is_admin) return fail("Essa conta já é admin.", 409);

    const { error } = await admin.from("profiles").upsert({ id: user.id, is_admin: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverFail("painel", "Não foi possível adicionar. Tente de novo.", err);
  }
}
