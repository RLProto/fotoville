import type { Order, OrderStatus } from "./types";

/** Situações em que a loja pode baixar as fotos: só depois do pagamento aprovado. */
export const DOWNLOADABLE: OrderStatus[] = ["paid", "in_production", "shipped", "ready_for_pickup", "delivered"];

/** Situações em que as imagens podem ser apagadas do bucket: já produzido, ou cancelado. */
export const DELETABLE: OrderStatus[] = ["in_production", "shipped", "ready_for_pickup", "delivered", "cancelled"];

/** Status que a lista de pedidos muda em massa. */
export const BULK_STATUSES = ["in_production", "shipped", "ready_for_pickup", "delivered", "cancelled"] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

type Rule = Pick<Order, "kind" | "status" | "photos_deleted_at">;

export const canDownload = (o: Rule) => o.kind === "prints" && DOWNLOADABLE.includes(o.status) && !o.photos_deleted_at;
export const canDeletePhotos = (o: Rule) => o.kind === "prints" && DELETABLE.includes(o.status) && !o.photos_deleted_at;

/**
 * Se o pedido pode ir para este status na ação em massa. Só o caminho normal do pedido; correções são
 * feitas uma a uma. A mesma regra está em bulk_order_status, no banco; npm run check:status confere as duas.
 */
export function canBulkChange(o: Pick<Order, "kind" | "status" | "shipping_service">, to: BulkStatus) {
  const prints = o.kind === "prints";
  const pickup = o.shipping_service === "retirada";
  switch (to) {
    case "in_production":
      return prints && o.status === "paid";
    case "shipped":
      return prints && !pickup && o.status === "in_production";
    case "ready_for_pickup":
      return prints && pickup && o.status === "in_production";
    case "delivered":
      return o.status === "shipped" || o.status === "ready_for_pickup";
    case "cancelled":
      return o.status === "pending";
  }
}

/** "Pagamento aprovado" só vale para quem aguarda pagamento: depois disso, não teria efeito. */
export const canPickStatus = (current: OrderStatus, status: OrderStatus) =>
  status !== "paid" || current === "pending" || current === "paid";

/** Por que o download não está liberado, para mostrar no painel. */
export function downloadBlockedReason(o: Rule): string | null {
  if (o.kind !== "prints") return "Pacote: não tem fotos.";
  if (o.photos_deleted_at) return "Imagens já apagadas do servidor.";
  if (o.status === "pending") return "Aguardando pagamento.";
  if (o.status === "cancelled") return "Pedido cancelado.";
  return null;
}
