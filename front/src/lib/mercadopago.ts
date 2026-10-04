import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { site } from "./site";

/**
 * Mercado Pago, Checkout Pro. O cliente é levado ao ambiente do Mercado Pago e paga
 * com Pix, cartão ou boleto. A confirmação chega pelo webhook /api/webhooks/mercadopago.
 */

export const hasMercadoPago = Boolean(process.env.MP_ACCESS_TOKEN);

function client() {
  if (!hasMercadoPago) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN!, options: { timeout: 10_000 } });
}

export async function createPreference(order: {
  id: string;
  number: number;
  total_cents: number;
  title: string;
  payerEmail?: string;
}) {
  const isHttps = site.url.startsWith("https://");
  const orderUrl = `${site.url}/pedido/${order.id}`;

  const preference = await new Preference(client()).create({
    body: {
      items: [
        {
          id: String(order.number),
          title: order.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: order.total_cents / 100,
        },
      ],
      payer: order.payerEmail ? { email: order.payerEmail } : undefined,
      external_reference: order.id,
      statement_descriptor: "FOTOVILLE",
      back_urls: { success: orderUrl, pending: orderUrl, failure: orderUrl },
      // O Mercado Pago só aceita retorno automático e webhook em URL pública https.
      ...(isHttps
        ? { auto_return: "approved" as const, notification_url: `${site.url}/api/webhooks/mercadopago` }
        : {}),
    },
  });

  // Tokens antigos de teste começam com TEST- e usam o link de sandbox. Os atuais (APP_USR-),
  // de teste ou de produção, usam o init_point normal.
  const sandbox = process.env.MP_ACCESS_TOKEN!.startsWith("TEST-");
  const init_point = (sandbox ? preference.sandbox_init_point : preference.init_point) ?? preference.init_point;
  if (!preference.id || !init_point) throw new Error("Mercado Pago não retornou o link de pagamento.");
  return { id: preference.id, init_point };
}

export async function getPayment(id: string) {
  const p = await new Payment(client()).get({ id });
  return {
    id: String(p.id),
    status: p.status ?? "unknown",
    external_reference: p.external_reference ?? null,
    amount_cents: Math.round((p.transaction_amount ?? 0) * 100),
    method: p.payment_type_id ?? p.payment_method_id ?? null,
  };
}

/**
 * Confere a assinatura do webhook (cabeçalho x-signature).
 * Sem MP_WEBHOOK_SECRET a checagem é pulada; ainda assim o pagamento é sempre
 * consultado direto na API antes de liberar o pedido.
 */
export function verifyWebhookSignature(headers: Headers, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = headers.get("x-signature") ?? "";
  const requestId = headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.trim().split("=") as [string, string]),
  );
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
