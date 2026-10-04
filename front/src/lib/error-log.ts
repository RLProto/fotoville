import "server-only";
import { hasSupabase } from "./site";
import { createAdminClient } from "./supabase/server";

export type ErrorEntry = {
  source: "client" | "server";
  /** Área do site: envio, editor, checkout, pagamento, frete, api... */
  scope: string;
  message: string;
  level?: "error" | "warning";
  detail?: Record<string, unknown>;
  url?: string | null;
  userId?: string | null;
  userAgent?: string | null;
};

const MAX_MESSAGE = 1000;
const MAX_DETAIL = 8000;

/** Texto e pilha de qualquer coisa lançada. */
export function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`, stack: err.stack?.slice(0, 4000) };
  // Erros do Supabase chegam como objeto { code, message, details }.
  if (err && typeof err === "object" && "message" in err) {
    const code = "code" in err && err.code ? `${err.code}: ` : "";
    return { message: `${code}${String(err.message)}`, stack: JSON.stringify(err).slice(0, 4000) };
  }
  return { message: typeof err === "string" ? err : (JSON.stringify(err) ?? String(err)) };
}

/** Detalhe em JSON dentro do limite: o que passar vira texto cortado. */
function boundedDetail(detail: Record<string, unknown> | undefined) {
  if (!detail) return null;
  const json = JSON.stringify(detail);
  return json.length <= MAX_DETAIL ? detail : { truncado: json.slice(0, MAX_DETAIL) };
}

/**
 * Grava um erro na tabela error_logs. Nunca lança: registrar erro não pode derrubar a requisição
 * de quem está comprando. Sem banco configurado, só escreve no console.
 */
export async function logError(entry: ErrorEntry) {
  const line = `[erro:${entry.scope}] ${entry.message}`;
  if (entry.level === "warning") console.warn(line, entry.detail ?? "");
  else console.error(line, entry.detail ?? "");
  if (!hasSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const { error } = await createAdminClient()
      .from("error_logs")
      .insert({
        level: entry.level ?? "error",
        source: entry.source,
        scope: entry.scope.slice(0, 40),
        message: entry.message.slice(0, MAX_MESSAGE),
        detail: boundedDetail(entry.detail),
        url: entry.url?.slice(0, 500) ?? null,
        user_id: entry.userId ?? null,
        user_agent: entry.userAgent?.slice(0, 400) ?? null,
        env: process.env.NODE_ENV === "production" ? "production" : "development",
      });
    if (error) console.error("[erro] não foi possível gravar em error_logs:", error.message);
  } catch (err) {
    console.error("[erro] não foi possível gravar em error_logs:", err);
  }
}
