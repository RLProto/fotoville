import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
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

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const params = await searchParams;
  const filter = params.filtro ?? "todos";
  const q = (params.q ?? "").trim().slice(0, 60);

  let query = createAdminClient().from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter === "abertos") query = query.in("status", ["paid", "in_production", "ready_for_pickup"]);
  else if (filter !== "todos") query = query.eq("status", filter as OrderStatus);
  if (q) {
    // Número do pedido, ou parte do nome ou do e-mail do cliente
    const text = q.replace(/[,()%]/g, "");
    query = /^#?\d+$/.test(q)
      ? query.eq("number", Number(q.replace("#", "")))
      : query.or(`customer->>name.ilike.%${text}%,customer->>email.ilike.%${text}%`);
  }

  const { data, error } = await query;
  const orders = (data ?? []) as Order[];
  const withQ = (value: string) => `/admin?filtro=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <h1 className="display-md text-3xl">Pedidos</h1>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrar pedidos" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={withQ(f.value)}
              aria-current={filter === f.value ? "page" : undefined}
              className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-outline"}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form action="/admin" method="get" role="search" className="flex items-center gap-2">
          <input type="hidden" name="filtro" value={filter} />
          <label htmlFor="busca" className="sr-only">
            Buscar por número do pedido ou cliente
          </label>
          <div className="relative">
            <MagnifyingGlassIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" aria-hidden />
            <input
              id="busca"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Nº do pedido ou cliente"
              className="field-input w-64 pl-10"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-outline">
            Buscar
          </button>
        </form>
      </div>

      {error && <p className="alert alert-danger mt-6">Erro ao carregar pedidos: {error.message}</p>}

      {orders.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-lg text-ink-2">
          {q ? `Nenhum pedido para "${q}".` : "Nenhum pedido neste filtro."}
        </p>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </>
  );
}
