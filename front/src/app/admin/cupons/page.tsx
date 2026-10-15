import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponActiveToggle } from "@/components/admin/coupon-active-toggle";
import { CouponStatusBadge } from "@/components/admin/coupon-status-badge";
import { NewCouponForm } from "@/components/admin/new-coupon-form";
import { couponLimitLabel, couponStatus, oncePerCustomer } from "@/lib/coupon-rules";
import { formatBRL, formatDate } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Cupons" };

export default async function AdminCuponsPage() {
  if (!(await getProfile())?.is_admin) notFound();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .eq("kind", "percent")
    .order("created_at", { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  // Usos: pedidos não cancelados com o cupom
  const uses = new Map<string, number>();
  if (coupons.length) {
    const { data: redemptions } = await admin
      .from("coupon_redemptions")
      .select("code, orders(status)")
      .in("code", coupons.map((c) => c.code));
    for (const r of (redemptions ?? []) as unknown as { code: string; orders: { status: string } | null }[]) {
      if (r.orders && r.orders.status !== "cancelled") uses.set(r.code, (uses.get(r.code) ?? 0) + 1);
    }
  }

  return (
    <>
      <h1 className="display-md text-3xl">Cupons</h1>

      <div className="mt-6">
        <NewCouponForm />
      </div>

      {error && <p className="alert alert-danger mt-6">Erro ao carregar os cupons: {error.message}</p>}

      {coupons.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-lg text-ink-2">Nenhum cupom ainda.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[66rem] text-left">
            <caption className="sr-only">Cupons</caption>
            <thead className="border-b border-rule text-sm text-ink-2">
              <tr>
                {["Cupom", "Desconto", "Pedido mínimo", "Válido até", "Usos", "Uma vez por cliente", "Situação", "Criado em", ""].map((h, i) => (
                  <th key={i} scope="col" className={`px-4 py-3 font-bold ${h === "Uma vez por cliente" ? "text-center" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const used = uses.get(c.code) ?? 0;
                return (
                  <tr key={c.code} className="border-b border-rule last:border-0 align-middle">
                    <td className="px-4 py-3">
                      <Link href={`/admin/cupons/${c.code}`} className="link font-bold tracking-wider">
                        {c.code}
                      </Link>
                      {c.description && <span className="block max-w-[32ch] text-sm text-ink-2">{c.description}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{c.percent_off}%</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {c.min_order_cents ? formatBRL(c.min_order_cents) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.expires_at ? formatDate(c.expires_at) : "Sem validade"}</td>
                    <td className="px-4 py-3">
                      <span className="block tabular-nums">{c.max_uses === null ? used : `${used} de ${c.max_uses}`}</span>
                      <span className="block text-sm text-ink-2">{couponLimitLabel(c)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{oncePerCustomer(c) ? "Sim" : "Não"}</td>
                    <td className="px-4 py-3">
                      <CouponStatusBadge status={couponStatus(c, used)} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <CouponActiveToggle code={c.code} active={c.active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
