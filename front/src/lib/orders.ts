import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCouponCode } from "./coupons";
import { logError } from "./error-log";
import { getPayment, hasMercadoPago } from "./mercadopago";
import type { Order, Package } from "./types";

/**
 * Marca o pedido como pago. É idempotente: só age se o pedido ainda estava pendente.
 * Pedido de pacote gera o cupom com os créditos de fotos.
 */
export async function markOrderPaid(
  admin: SupabaseClient,
  orderId: string,
  payment: { id: string | null; method: string | null },
) {
  const { data: order } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      mp_payment_id: payment.id,
      payment_method: payment.method,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!order) return null; // já processado ou inexistente
  const paid = order as Order;

  if (paid.kind === "package" && paid.package_id) {
    const { data: pkg } = await admin.from("packages").select("*").eq("id", paid.package_id).single();
    const p = pkg as Package;
    const { error } = await admin.from("coupons").insert({
      code: generateCouponCode(),
      kind: "credits",
      user_id: paid.user_id,
      product_id: p.product_id,
      credits_total: p.photo_count,
      source_order_id: paid.id,
    });
    if (error) {
      await logError({
        source: "server",
        scope: "pagamento",
        message: `Cupom do pacote não foi criado: ${error.message}`,
        userId: paid.user_id,
        detail: { order: paid.id, package: p.id },
      });
    }
  }

  return paid;
}

/**
 * Consulta um pagamento no Mercado Pago e, se aprovado e com o valor certo,
 * libera o pedido. Usado pelo webhook e pela volta do checkout.
 */
export async function syncPayment(admin: SupabaseClient, paymentId: string) {
  if (!hasMercadoPago) return null;
  const payment = await getPayment(paymentId);
  if (!payment.external_reference) return null;

  const { data } = await admin
    .from("orders")
    .select("id, status, total_cents")
    .eq("id", payment.external_reference)
    .maybeSingle();
  if (!data) return null;

  if (payment.status === "approved" && data.status === "pending") {
    if (payment.amount_cents < data.total_cents) {
      await logError({
        source: "server",
        scope: "pagamento",
        message: "Pagamento aprovado com valor menor que o total do pedido",
        detail: { order: data.id, payment: payment.id, pago: payment.amount_cents, total: data.total_cents },
      });
      return null;
    }
    return markOrderPaid(admin, data.id, { id: payment.id, method: payment.method });
  }
  return null;
}
