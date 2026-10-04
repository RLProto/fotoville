import { after, NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/error-log";
import { getUser } from "@/lib/supabase/server";

const reportSchema = z.object({
  scope: z.string().min(1).max(40),
  message: z.string().min(1).max(2000),
  level: z.enum(["error", "warning"]).optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  url: z.string().max(500).optional(),
});

const MAX_BODY = 16_000;
const PER_MINUTE = 30;
/** Limite simples por endereço, por instância do servidor: barra enxurrada, não ataque dedicado. */
const recent = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length <= PER_MINUTE;
}

/** Recebe erros que aconteceram no navegador do cliente (ver src/lib/report-error.ts). */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!allowed(ip)) return new NextResponse(null, { status: 429 });

  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const parsed = reportSchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const report = parsed.data;
  const userAgent = request.headers.get("user-agent");
  // Grava depois de responder: o navegador não espera o banco.
  after(async () => {
    const user = await getUser().catch(() => null);
    await logError({ source: "client", ...report, userId: user?.id, userAgent });
  });
  return new NextResponse(null, { status: 204 });
}
