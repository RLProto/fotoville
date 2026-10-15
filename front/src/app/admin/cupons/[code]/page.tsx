import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponActiveToggle } from "@/components/admin/coupon-active-toggle";
import { CouponStatusBadge } from "@/components/admin/coupon-status-badge";
import { StatusBadge } from "@/components/order-status";
import { COUPON_CODE, couponStatus } from "@/lib/coupon-rules";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { Coupon, OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Cupom" };

type Use = {
  discount_cents: number;
  created_at: string;
  orders: { id: string; number: number; status: OrderStatus; customer: { name?: string; email?: string } | null } | null;
};

export default async function AdminCupomPage({ params }: { params: Promise<{ code: string }> }) {
  if (!(await getProfile())?.is_admin) notFound();
  const { code } = await params;
  if (!COUPON_CODE.test(code)) notFound();

  const admin = createAdminClient();
  const [{ data }, { data: rows }] = await Promise.all([
    admin.from("coupons").select("*").eq("code", code).eq("kind", "percent").maybeSingle(),
    admin
      .from("coupon_redemptions")
      .select("discount_cents, created_at, orders(id, number, status, customer)")
      .eq("code", code)
      .order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const coupon = data as Coupon;
  const history = ((rows ?? []) as unknown as Use[]).filter((u) => u.orders);
  // Pedido cancelado devolve o uso
  const valid = history.filter((u) => u.orders!.status !== "cancelled");
  const given = valid.reduce((sum, u) => sum + u.discount_cents, 0);

  const facts: [string, string][] = [
    ["Desconto", `${coupon.percent_off}% no pedido, frete incluído`],
    ["Pedido mínimo", coupon.min_order_cents ? `${formatBRL(coupon.min_order_cents)} em fotos` : "Sem mínimo"],
    ["Válido até", coupon.expires_at ? formatDate(coupon.expires_at) : "Sem validade"],
    ["Usos", coupon.max_uses === null ? `${valid.length}, sem limite` : `${valid.length} de ${coupon.max_uses}`],
    ["Por cliente", coupon.max_uses === 1 ? "Uso único" : coupon.once_per_customer ? "Uma vez" : "Sem limite"],
    ["Desconto dado", formatBRL(given)],
    ["Criado em", formatDate(coupon.created_at)],
  ];

  return (
    <>
      <p>
        <Link href="/admin/cupons" className="link text-sm">
          Todos os cupons
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-wider">{coupon.code}</h1>
        <CouponStatusBadge status={couponStatus(coupon, valid.length)} />
        <CouponActiveToggle code={coupon.code} active={coupon.active} />
      </div>
      {coupon.description && <p className="mt-2 max-w-[62ch] text-ink-2">{coupon.description}</p>}

      <dl className="card mt-6 grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-2">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="historico-cupom">
        <h2 id="historico-cupom" className="border-b border-ink pb-2 text-lg font-bold">
          Histórico de uso
        </h2>
        {history.length === 0 ? (
          <p className="mt-4 text-ink-2">Ninguém usou este cupom ainda.</p>
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left">
              <caption className="sr-only">Pedidos com o cupom {coupon.code}</caption>
              <thead className="border-b border-rule text-sm text-ink-2">
                <tr>
                  {["Data", "Pedido", "Cliente", "Desconto", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((u) => {
                  const order = u.orders!;
                  return (
                    <tr key={order.id} className="border-b border-rule last:border-0 align-middle">
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatDateTime(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/pedidos/${order.id}`} className="link font-semibold tabular-nums">
                          #{order.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{order.customer?.name ?? "—"}</span>
                        {order.customer?.email && <span className="block text-sm break-all text-ink-2">{order.customer.email}</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatBRL(u.discount_cents)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {history.length > valid.length && (
          <p className="mt-3 text-sm text-ink-2">Pedido cancelado não conta como uso.</p>
        )}
      </section>
    </>
  );
}
