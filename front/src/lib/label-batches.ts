/**
 * Lotes de etiquetas da aba Etiquetas: "Gerar etiquetas" junta os pedidos aprovados num lote, e imprimir o lote
 * passa os aprovados para "Em produção". As regras de quem entra ficam no banco (label_batch_candidates).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllProducts } from "./admin-orders";
import { labelsFor, type LabelData } from "./order-label";
import { canDownload } from "./order-rules";
import type { Order, OrderItem, OrderStatus } from "./types";

/** Lotes por página da aba, do mais novo para o mais antigo. */
export const BATCHES_PER_PAGE = 30;
/** Pedidos por consulta de itens: cada consulta entrega no máximo 1000 linhas, e a lista de pedidos vai na URL. */
const ITEMS_BATCH = 50;
const ORDER_COLUMNS =
  "id, number, kind, status, customer, note, shipping_service, shipping_address, label_ready_at, photos_deleted_at";

type BatchOrderRow = Pick<
  Order,
  | "id"
  | "number"
  | "kind"
  | "status"
  | "customer"
  | "note"
  | "shipping_service"
  | "shipping_address"
  | "label_ready_at"
  | "photos_deleted_at"
>;

/** Pedido do lote como vai para o navegador: nada de CPF, WhatsApp ou e-mail do cliente. */
export type BatchOrder = {
  id: string;
  number: number;
  customer: string;
  note: string | null;
  /** Cidade da entrega, ou "Retirada na loja". */
  place: string;
  status: OrderStatus;
  /** Fotos já baixadas alguma vez. */
  downloaded: boolean;
  /** Fotos ainda no servidor e pedido em situação de baixar. */
  downloadable: boolean;
};

export type BatchView = {
  id: string;
  number: number;
  createdAt: string;
  printedAt: string | null;
  /** Etiquetas no PDF (pedido com muitos tamanhos ganha duas); cancelados ficam de fora. */
  labels: number;
  orders: BatchOrder[];
};

/** Etiquetas de cada pedido, com os tamanhos tirados dos itens. */
async function labelsByOrder(admin: SupabaseClient, orders: BatchOrderRow[]) {
  const [products, ...batches] = await Promise.all([
    loadAllProducts(admin),
    ...Array.from({ length: Math.ceil(orders.length / ITEMS_BATCH) }, (_, i) =>
      admin
        .from("order_items")
        .select("order_id, product_id, quantity")
        .in(
          "order_id",
          orders.slice(i * ITEMS_BATCH, (i + 1) * ITEMS_BATCH).map((o) => o.id),
        ),
    ),
  ]);
  const error = batches.find((b) => b.error)?.error;
  if (error) throw new Error(error.message);

  const items = new Map<string, Pick<OrderItem, "product_id" | "quantity">[]>();
  for (const item of batches.flatMap((b) => b.data ?? [])) {
    items.set(item.order_id, [...(items.get(item.order_id) ?? []), item]);
  }
  return new Map(
    orders.map((order) => [order.id, labelsFor(order, items.get(order.id) ?? [], products)] as const),
  );
}

const live = (o: { status: OrderStatus }) => o.status !== "cancelled";

/** Uma página de lotes, o total de lotes e quantos pedidos esperam o próximo. Lança erro se o banco falhar. */
export async function loadBatches(
  admin: SupabaseClient,
  page = 1,
): Promise<{ batches: BatchView[]; waiting: number; total: number }> {
  const from = (page - 1) * BATCHES_PER_PAGE;
  const [list, candidates] = await Promise.all([
    admin
      .from("label_batches")
      .select(`id, number, created_at, printed_at, orders (${ORDER_COLUMNS})`, { count: "exact" })
      .order("number", { ascending: false })
      .order("number", { referencedTable: "orders", ascending: true })
      .range(from, from + BATCHES_PER_PAGE - 1),
    admin.rpc("label_batch_candidates"),
  ]);
  if (candidates.error) throw new Error(candidates.error.message);
  if (list.error?.code === "PGRST103") {
    // Página além da última: o banco recusa a faixa em vez de devolver vazio; a página leva à última
    const { count, error } = await admin.from("label_batches").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { batches: [], waiting: (candidates.data ?? []).length, total: count ?? 0 };
  }
  if (list.error) throw new Error(list.error.message);

  const rows = (list.data ?? []) as unknown as {
    id: string;
    number: number;
    created_at: string;
    printed_at: string | null;
    orders: BatchOrderRow[];
  }[];
  const labels = await labelsByOrder(admin, rows.flatMap((b) => b.orders).filter(live));

  const batches = rows.map((batch) => ({
    id: batch.id,
    number: batch.number,
    createdAt: batch.created_at,
    printedAt: batch.printed_at,
    labels: batch.orders.reduce((sum, o) => sum + (labels.get(o.id)?.length ?? 0), 0),
    orders: batch.orders.map((o) => ({
      id: o.id,
      number: o.number,
      customer: o.customer?.name || o.customer?.email || "Sem nome",
      note: o.note,
      place: o.shipping_address ? o.shipping_address.city : "Retirada na loja",
      status: o.status,
      downloaded: Boolean(o.label_ready_at),
      downloadable: canDownload(o),
    })),
  }));
  return { batches, waiting: (candidates.data ?? []).length, total: list.count ?? batches.length };
}

/**
 * Etiquetas de um lote, lidas na hora de imprimir: pegam a descrição que o cliente editou depois de a aba abrir.
 * null quando o lote não existe.
 */
export async function loadBatchLabels(admin: SupabaseClient, id: string): Promise<LabelData[] | null> {
  const { data, error } = await admin
    .from("label_batches")
    .select(`id, orders (${ORDER_COLUMNS})`)
    .eq("id", id)
    .order("number", { referencedTable: "orders", ascending: true })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const orders = (data.orders as unknown as BatchOrderRow[]).filter(live);
  const labels = await labelsByOrder(admin, orders);
  return orders.flatMap((o) => labels.get(o.id) ?? []);
}
