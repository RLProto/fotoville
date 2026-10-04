import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/order-status";
import { formatBRL, formatDate } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "abertos", label: "Para produzir" },
  { value: "pending", label: ORDER_STATUS_LABEL.pending },
  { value: "shipped", label: "Enviados" },
  { value: "todos", label: "Todos" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const filter = (await searchParams).filtro ?? "abertos";
  let query = createAdminClient().from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter === "abertos") query = query.in("status", ["paid", "in_production", "ready_for_pickup"]);
  else if (filter !== "todos") query = query.eq("status", filter as OrderStatus);

  const { data, error } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <>
      <h1 className="display-md text-3xl">Pedidos</h1>
      <nav aria-label="Filtrar pedidos" className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin?filtro=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-outline"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error && <p className="alert alert-danger mt-6">Erro ao carregar pedidos: {error.message}</p>}

      {orders.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-lg text-ink-2">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <caption className="sr-only">Pedidos</caption>
            <thead className="border-b border-rule text-sm text-ink-2">
              <tr>
                {["Pedido", "Data", "Cliente", "Tipo", "Entrega", "Total", "Situação"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-rule last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-action underline underline-offset-2">
                      #{order.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">{order.customer?.name || order.customer?.email || "Sem nome"}</td>
                  <td className="px-4 py-3">{order.kind === "package" ? "Pacote" : "Revelação"}</td>
                  <td className="px-4 py-3">{order.shipping_label ?? (order.kind === "package" ? "Sem entrega" : "A definir")}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{formatBRL(order.total_cents)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
