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
  { value: "concluidos", label: "Concluídos" },
];

const PAGE = 1000; // o Supabase devolve no máximo 1.000 linhas por consulta

/**
 * Todos os pedidos do filtro: a busca por número ou cliente e a paginação são feitas na lista, no navegador.
 * Pacotes ficam fora enquanto a aba Pacotes do site estiver oculta.
 */
async function loadOrders(filter: string) {
  const admin = createAdminClient();
  const orders: Order[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin
      .from("orders")
      .select("*")
      .eq("kind", "prints")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (filter === "abertos") query = query.in("status", ["paid", "in_production"]);
    else if (filter === "concluidos") query = query.in("status", ["shipped", "ready_for_pickup", "delivered"]);
    else if (filter !== "todos") query = query.eq("status", filter as OrderStatus);
    const { data, error } = await query;
    if (error) return { orders, error };
    orders.push(...((data ?? []) as Order[]));
    if (!data || data.length < PAGE) return { orders, error: null };
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const filter = (await searchParams).filtro ?? "todos";

  const { orders, error } = await loadOrders(filter);

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
        <OrdersTable key={filter} orders={orders} />
      )}
    </>
  );
}
