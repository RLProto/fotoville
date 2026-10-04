import "server-only";
import { headers } from "next/headers";
import { after, NextResponse } from "next/server";
import { describeError, logError } from "./error-log";
import { hasSupabase } from "./site";
import { createClient, getUser } from "./supabase/server";

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Registra em error_logs um erro de rota de API, depois de responder: com a página de onde o cliente
 * veio, quem estava logado e o navegador. Só funciona dentro de rotas de API e ações.
 */
export function reportServerError(
  scope: string,
  err: unknown,
  detail?: Record<string, unknown>,
  level: "error" | "warning" = "error",
) {
  const { message, stack } = describeError(err);
  after(async () => {
    const h = await headers();
    const user = await getUser().catch(() => null);
    await logError({
      source: "server",
      scope,
      level,
      message,
      detail: { ...detail, stack },
      url: h.get("referer"),
      userId: user?.id,
      userAgent: h.get("user-agent"),
    });
  });
}

/** Falha do servidor: responde `message` ao cliente e registra o erro técnico em error_logs. */
export function serverFail(scope: string, message: string, err?: unknown, status = 500, detail?: Record<string, unknown>) {
  reportServerError(scope, err ?? message, { ...detail, response: message, status });
  return fail(message, status);
}

/** Exige usuário logado numa rota de API. Retorna o usuário e o cliente com a sessão dele. */
export async function requireUser() {
  if (!hasSupabase) return { error: fail("Banco de dados não configurado.", 503) } as const;
  const user = await getUser();
  if (!user) return { error: fail("Faça login para continuar.", 401) } as const;
  return { user, supabase: await createClient() } as const;
}

export async function requireAdmin() {
  const auth = await requireUser();
  if ("error" in auth) return auth;
  const { data } = await auth.supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  if (!data?.is_admin) return { error: fail("Acesso restrito.", 403) } as const;
  return auth;
}
