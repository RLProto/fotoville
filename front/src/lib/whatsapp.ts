import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { onlyDigits } from "./format";

/**
 * WhatsApp Cloud API (Meta), para mensagens aos clientes. O bot do bucket e dos erros, que só fala
 * com a equipe, é outro: CallMeBot, no Supabase. Fora da janela de 24 horas só sai modelo aprovado
 * no WhatsApp Manager, com o mesmo nome e idioma usados aqui.
 */

const GRAPH = "https://graph.facebook.com/v24.0";

export const hasWhatsApp = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Modelo do aviso de carrinho (categoria utilidade): corpo com {{1}} = data, botões "Ver carrinho" e "Parar avisos". */
export const CART_TEMPLATE = process.env.WHATSAPP_TEMPLATE_CARRINHO ?? "carrinho_expira";

/** Número salvo no perfil (DDD + número) no formato da API: 55 na frente. */
export function toWaNumber(stored: string | null | undefined) {
  const d = onlyDigits(stored ?? "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

export async function sendTemplate(to: string, template: string, bodyParams: string[]) {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    throw new Error(`WhatsApp ${res.status}${json.error?.code ? ` (${json.error.code})` : ""}: ${json.error?.message ?? "sem resposta"}`);
  }
  return json.messages[0].id;
}

/** Confere a assinatura X-Hub-Signature-256 do webhook com o segredo do app. */
export function verifyWhatsAppSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === expected.length && timingSafeEqual(got, expected);
}
