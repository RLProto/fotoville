import { notFound } from "next/navigation";
import { LabelsTable, type LabelRow } from "@/components/admin/labels-table";
import { loadAllProducts } from "@/lib/admin-orders";
import { labelsFor } from "@/lib/order-label";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { Order, OrderItem } from "@/lib/types";

/** Impressas que continuam na lista, para reimprimir; as não impressas aparecem todas. */
const PRINTED_SHOWN = 100;
const ITEMS_BATCH = 50;
const COLUMNS = "id, number, customer, shipping_service, shipping_address, label_ready_at, label_printed_at";

type LabelOrder = Pick<
  Order,
  "id" | "number" | "customer" | "shipping_service" | "shipping_address" | "label_ready_at" | "label_printed_at"
>;

export default async function LabelsPage() {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const admin = createAdminClient();
  const ready = () =>
    admin.from("orders").select(COLUMNS).not("label_ready_at", "is", null).neq("status", "cancelled");
  const [waiting, printed, products] = await Promise.all([
    ready().is("label_printed_at", null).order("label_ready_at", { ascending: true }),
    ready()
      .not("label_printed_at", "is", null)
      .order("label_printed_at", { ascending: false })
      .limit(PRINTED_SHOWN),
    loadAllProducts(admin),
  ]);
  const orders = [...(waiting.data ?? []), ...(printed.data ?? [])] as LabelOrder[];

  // Em lotes: cada consulta entrega no máximo 1000 linhas, e a lista de pedidos vai na URL
  const batches = await Promise.all(
    Array.from({ length: Math.ceil(orders.length / ITEMS_BATCH) }, (_, i) =>
      admin
        .from("order_items")
        .select("order_id, product_id, quantity")
        .in(
          "order_id",
          orders.slice(i * ITEMS_BATCH, (i + 1) * ITEMS_BATCH).map((o) => o.id),
        ),
    ),
  );
  const items = new Map<string, Pick<OrderItem, "product_id" | "quantity">[]>();
  for (const item of batches.flatMap((b) => b.data ?? [])) {
    items.set(item.order_id, [...(items.get(item.order_id) ?? []), item]);
  }
  const error = waiting.error ?? printed.error ?? batches.find((b) => b.error)?.error;

  // Só o que a etiqueta usa vai para o navegador: nada de CPF ou WhatsApp do cliente
  const rows: LabelRow[] = orders.map((order) => ({
    id: order.id,
    labels: labelsFor(order, items.get(order.id) ?? [], products),
    readyAt: order.label_ready_at!,
    printedAt: order.label_printed_at,
  }));

  return (
    <>
      <h1 className="display-md text-3xl">Etiquetas</h1>
      {/* Com erro, nada de lista: etiqueta sem os tamanhos não pode ir para o PDF */}
      {error ? (
        <p className="alert alert-danger mt-6">Erro ao carregar etiquetas: {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-lg text-ink-2">As etiquetas aparecem aqui quando as fotos do pedido são baixadas.</p>
      ) : (
        <LabelsTable rows={rows} />
      )}
    </>
  );
}
