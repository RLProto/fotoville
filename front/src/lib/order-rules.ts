import type { Order, OrderStatus } from "./types";

/** Situações em que a loja pode baixar as fotos: só depois do pagamento aprovado. */
export const DOWNLOADABLE: OrderStatus[] = ["paid", "in_production", "shipped", "ready_for_pickup", "delivered"];

/** Situações em que as imagens podem ser apagadas do bucket: já produzido, ou cancelado. */
export const DELETABLE: OrderStatus[] = ["in_production", "shipped", "ready_for_pickup", "delivered", "cancelled"];

type Rule = Pick<Order, "kind" | "status" | "photos_deleted_at">;

export const canDownload = (o: Rule) => o.kind === "prints" && DOWNLOADABLE.includes(o.status) && !o.photos_deleted_at;
export const canDeletePhotos = (o: Rule) => o.kind === "prints" && DELETABLE.includes(o.status) && !o.photos_deleted_at;

/** Por que o download não está liberado, para mostrar no painel. */
export function downloadBlockedReason(o: Rule): string | null {
  if (o.kind !== "prints") return "Pacote: não tem fotos.";
  if (o.photos_deleted_at) return "Imagens já apagadas do bucket.";
  if (o.status === "pending") return "Liberado depois do pagamento aprovado.";
  if (o.status === "cancelled") return "Pedido cancelado.";
  return null;
}
