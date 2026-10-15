import Link from "next/link";
import { notFound } from "next/navigation";
import { OrdersTable } from "@/components/admin/orders-table";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abertos", label: "Para produzir" },
  { value: "pending", label: ORDER_STATUS_LABEL.pending },
  { value: "shipped", label: "Enviados" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const filter = (await searchParams).filtro ?? "todos";

  // Até 500 pedidos: a busca por número ou cliente é feita na lista, no navegador
  let query = createAdminClient().from("orders").select("*").order("created_at", { ascending: false }).limit(500);
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
        <div className="wide">
          <OrdersTable orders={orders} />
        </div>
      )}
    </>
  );
}
