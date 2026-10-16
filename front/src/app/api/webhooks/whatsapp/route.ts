import { NextResponse } from "next/server";
import { logError } from "@/lib/error-log";
import { onlyDigits } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWhatsAppSignature } from "@/lib/whatsapp";

/**
 * Webhook do WhatsApp Cloud API. No app da Meta: WhatsApp > Configuração > Webhook, URL
 * https://SEU-DOMINIO/api/webhooks/whatsapp, token de verificação = WHATSAPP_VERIFY_TOKEN,
 * campo "messages" assinado.
 */

/** Verificação feita pela Meta ao salvar a URL. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type Change = {
  value?: {
    messages?: { from: string; type: string; button?: { text?: string; payload?: string }; text?: { body?: string } }[];
    statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[];
  };
};

const STOP = /^\s*(parar( avisos)?|sair|stop)\s*$/i;
const STATUS: Record<string, string> = { delivered: "entregue", read: "lido", failed: "falhou" };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWhatsAppSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { entry?: { changes?: Change[] }[] };
  const admin = createAdminClient();

  for (const change of body.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    for (const msg of change.value?.messages ?? []) {
      const said = msg.button?.payload ?? msg.button?.text ?? msg.text?.body ?? "";
      if (STOP.test(said)) await stopNotices(admin, msg.from);
    }
    for (const st of change.value?.statuses ?? []) {
      const status = STATUS[st.status];
      if (!status) continue;
      const error = st.errors?.map((e) => `${e.code ?? ""} ${e.title ?? e.message ?? ""}`.trim()).join("; ") || null;
      // "lido" não volta para "entregue" se as notificações chegarem fora de ordem
      let query = admin.from("cart_notices").update({ status, error }).eq("message_id", st.id);
      if (status === "entregue") query = query.neq("status", "lido");
      await query;
      if (status === "falhou") {
        await logError({ source: "server", scope: "whatsapp", level: "warning", message: error ?? "Mensagem não entregue.", detail: { mensagem: st.id } });
      }
    }
  }
  // 200 sempre que a assinatura confere: a Meta reenvia o que receber erro
  return NextResponse.json({ ok: true });
}

/** O número chega como 55 + DDD + número, às vezes sem o nono dígito. O perfil guarda DDD + número. */
async function stopNotices(admin: ReturnType<typeof createAdminClient>, from: string) {
  const d = onlyDigits(from).replace(/^55/, "");
  const candidates = d.length === 10 ? [d, `${d.slice(0, 2)}9${d.slice(2)}`] : [d];
  const { error } = await admin.from("profiles").update({ whatsapp_avisos: false }).in("whatsapp", candidates);
  if (error) await logError({ source: "server", scope: "whatsapp", message: error.message, detail: { etapa: "parar avisos" } });
}
