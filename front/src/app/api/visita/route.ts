import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabase } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({ path: z.string().min(1).max(200) });

/** Dia em Brasília, no formato YYYY-MM-DD. */
function todayBrazil() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Registra uma página aberta no site, para a aba Estatísticas. O visitante é um hash do dia com
 * o IP e o navegador: dá para contar visitantes únicos no dia sem guardar IP nem cookie.
 * Robôs e o painel não contam.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const path = parsed.data.path.split("?")[0];
  const agent = request.headers.get("user-agent") ?? "";
  if (path.startsWith("/admin") || path.startsWith("/api") || /bot|crawl|spider|preview|headless|lighthouse/i.test(agent)) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "";
  const day = todayBrazil();
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 16);
  const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${agent}`).digest("base64url").slice(0, 24);

  await createAdminClient()
    .from("page_views")
    .insert({ day, path: path.slice(0, 200), visitor })
    .then(() => undefined, () => undefined); // visita perdida não vira erro para o cliente
  return new NextResponse(null, { status: 204 });
}
