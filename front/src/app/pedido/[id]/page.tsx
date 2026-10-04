import { TicketIcon, WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import { describeError, logError } from "@/lib/error-log";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline, StatusBadge } from "@/components/order-status";
import { formatBRL, formatCep, formatDate } from "@/lib/format";
import { hasMercadoPago } from "@/lib/mercadopago";
import { syncPayment } from "@/lib/orders";
import { site, whatsappLink } from "@/lib/site";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Coupon, Order, OrderItem } from "@/lib/types";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_id?: string; semPagamento?: string; erroPagamento?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PedidoPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const load = async () => (await supabase.from("orders").select("*").eq("id", id).maybeSingle()).data as Order | null;

  let order = await load();
  if (!order) notFound(); // RLS: só o dono enxerga o pedido

  // Volta do Mercado Pago: confere o pagamento na hora, sem depender do webhook.
  if (order.status === "pending" && query.payment_id && /^\d+$/.test(query.payment_id) && hasMercadoPago) {
    try {
      await syncPayment(createAdminClient(), query.payment_id);
      order = (await load()) ?? order;
    } catch (err) {
      await logError({
        source: "server",
        scope: "pagamento",
        ...describeError(err),
        url: `/pedido/${id}`,
        userId: order.user_id,
        detail: { order: id, payment: query.payment_id, etapa: "conferência na volta do Mercado Pago" },
      });
    }
  }

  const [{ data: items }, { data: coupons }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("coupons").select("*").eq("source_order_id", id),
  ]);
  const coupon = (coupons?.[0] ?? null) as Coupon | null;
  const address = order.shipping_address;
  const pickup = order.shipping_service === "retirada";

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-md text-3xl sm:text-4xl">Pedido #{order.number}</h1>
          <p className="mt-1 text-ink-2">Feito em {formatDate(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 space-y-4" aria-live="polite">
        {order.status === "pending" && (
          <div className="alert alert-warning flex-col sm:flex-row sm:items-center sm:justify-between">
            <p>
              {query.erroPagamento ? (
                "O pagamento não abriu. Seu pedido está salvo."
              ) : query.semPagamento || !order.mp_init_point ? (
                <>
                  Pedido registrado. O pagamento não abriu.{" "}
                  <a
                    href={whatsappLink(`Olá, preciso de ajuda para pagar o pedido #${order.number}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline underline-offset-2"
                  >
                    Falar no WhatsApp
                  </a>
                </>
              ) : order.kind === "package" ? (
                "Pague para receber o cupom."
              ) : (
                "Pague para o pedido entrar em produção."
              )}
            </p>
            {order.mp_init_point && (
              <a href={order.mp_init_point} className="btn btn-accent shrink-0">
                Pagar agora
              </a>
            )}
          </div>
        )}
        {order.status === "paid" && order.kind === "prints" && (
          <p className="alert alert-success">
            Pagamento aprovado. Fica pronto em até {site.productionDays} dias úteis.
          </p>
        )}
        {order.status === "cancelled" && <p className="alert alert-danger">Este pedido foi cancelado.</p>}
      </div>

      {coupon && (
        <section className="card mt-6 border-2 border-action p-6" aria-labelledby="cupom-pacote">
          <h2 id="cupom-pacote" className="flex items-center gap-2 text-xl font-bold">
            <TicketIcon size={22} className="text-action" aria-hidden />
            Seu cupom
          </h2>
          <p className="mt-3 font-display text-3xl font-bold tracking-wider text-ink select-all">{coupon.code}</p>
          <p className="mt-2 text-ink/85">
            Saldo: <strong>{coupon.credits_total - coupon.credits_used}</strong> de {coupon.credits_total} fotos{" "}
            {coupon.product_id}. Use ao pagar.
          </p>
          <Link href={`/enviar/${coupon.product_id}`} className="btn btn-accent mt-4">
            Enviar fotos
          </Link>
        </section>
      )}

      <section className="card mt-6 p-6" aria-labelledby="andamento">
        <h2 id="andamento" className="mb-5 text-xl font-bold">
          Andamento
        </h2>
        <OrderTimeline order={order} />
        {order.tracking_code && (
          <p className="mt-5">
            Código de rastreio: <strong className="select-all">{order.tracking_code}</strong>.{" "}
            <a
              href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(order.tracking_code)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-action underline underline-offset-2"
            >
              Rastrear nos Correios
            </a>
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby="itens">
          <h2 id="itens" className="text-xl font-bold">
            Itens
          </h2>
          <dl className="mt-4 space-y-2">
            {((items ?? []) as OrderItem[]).map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <dt>
                  {item.quantity}× {item.description}
                </dt>
                <dd className="font-semibold tabular-nums">{formatBRL(item.total_cents)}</dd>
              </div>
            ))}
            {order.discount_cents > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt>Cupom {order.coupon_code}</dt>
                <dd className="font-semibold tabular-nums">− {formatBRL(order.discount_cents)}</dd>
              </div>
            )}
            {order.kind === "prints" && (
              <div className="flex justify-between gap-4">
                <dt>Frete</dt>
                <dd className="font-semibold tabular-nums">
                  {order.shipping_cents ? formatBRL(order.shipping_cents) : "Grátis"}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-rule pt-3 text-lg">
              <dt className="font-bold">Total</dt>
              <dd className="font-display font-bold text-ink tabular-nums">{formatBRL(order.total_cents)}</dd>
            </div>
          </dl>
        </section>

        {order.kind === "prints" && (
          <section className="card p-6" aria-labelledby="entrega">
            <h2 id="entrega" className="text-xl font-bold">
              {pickup ? "Retirada na loja" : "Entrega"}
            </h2>
            {pickup ? (
              <>
                <address className="mt-4 not-italic text-ink/90">
                  {site.address.street}
                  <br />
                  {site.address.district}, {site.address.city}/{site.address.state}
                </address>
                <p className="mt-3 text-ink-2">
                  Pronto em até {site.productionDays} dias úteis depois do pagamento. Avisamos pelo WhatsApp.
                </p>
              </>
            ) : (
              address && (
                <>
                  <p className="mt-4 font-bold">
                    {order.shipping_label}
                    {order.shipping_days != null && (
                      <span className="font-normal text-ink-2">
                        , até {site.productionDays + order.shipping_days} dias úteis depois do pagamento
                      </span>
                    )}
                  </p>
                  <address className="mt-2 not-italic text-ink/90">
                    {address.street}, {address.number}
                    {address.complement ? ` - ${address.complement}` : ""}
                    <br />
                    {address.district}, {address.city}/{address.state}
                    <br />
                    CEP {formatCep(address.cep)}
                  </address>
                </>
              )
            )}
          </section>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/conta" className="btn btn-outline">
          Meus pedidos
        </Link>
        <a
          href={whatsappLink(`Olá, tenho uma dúvida sobre o pedido #${order.number}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
        >
          <WhatsappLogoIcon size={18} aria-hidden />
          Falar sobre este pedido
        </a>
      </div>
    </div>
  );
}
