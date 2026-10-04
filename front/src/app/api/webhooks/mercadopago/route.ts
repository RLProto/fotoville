import { NextResponse } from "next/server";
import { reportServerError } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/mercadopago";
import { syncPayment } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Notificações do Mercado Pago. Configure em Suas integrações > Webhooks, evento "Pagamentos",
 * apontando para https://SEU-DOMINIO/api/webhooks/mercadopago.
 * A notificação só diz qual pagamento mudou; o estado real é sempre consultado na API.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    data?: { id?: string | number };
  };

  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (type !== "payment" || !dataId) return NextResponse.json({ ignored: true });

  if (!verifyWebhookSignature(request.headers, url.searchParams.get("data.id") ?? dataId)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  try {
    await syncPayment(createAdminClient(), dataId);
  } catch (err) {
    reportServerError("pagamento", err, { payment: dataId, etapa: "webhook do Mercado Pago" });
    // 500 faz o Mercado Pago reenviar a notificação mais tarde.
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
