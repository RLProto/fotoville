import { CheckIcon } from "@phosphor-icons/react/ssr";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

export type OrderEvent = { status: OrderStatus; created_at: string };

/** Ordem natural das situações de um pedido de revelação. */
const FLOW: OrderStatus[] = ["pending", "paid", "in_production", "shipped", "ready_for_pickup", "delivered"];

/**
 * Linha do tempo do pedido no painel: cada situação com data e hora de quando entrou.
 * Etapas futuras aparecem apagadas; a atual sem registro (pedido antigo) aparece sem data.
 */
export function OrderHistory({ order, events }: { order: Pick<Order, "status" | "kind" | "shipping_service">; events: OrderEvent[] }) {
  const at = new Map<OrderStatus, string>();
  for (const e of events) if (!at.has(e.status)) at.set(e.status, e.created_at);

  const pickup = order.shipping_service === "retirada";
  const steps: OrderStatus[] =
    order.kind === "package"
      ? ["pending", "paid"]
      : FLOW.filter((s) => (pickup ? s !== "shipped" : s !== "ready_for_pickup"));
  if (order.status === "cancelled") steps.push("cancelled");

  const currentIndex = steps.indexOf(order.status);

  const label = (s: OrderStatus) => {
    if (s === "shipped" && order.shipping_service === "motoboy") return "Saiu com o motoboy";
    if (s === "delivered" && pickup) return "Retirado";
    if (s === "pending") return "Pedido criado";
    return ORDER_STATUS_LABEL[s];
  };

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const when = at.get(s);
        const done = i <= currentIndex && (when || i === currentIndex);
        const current = i === currentIndex;
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-rule" />}
            <span
              aria-hidden
              className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? s === "cancelled"
                    ? "border-danger bg-danger text-white"
                    : "border-action bg-action text-white"
                  : "border-rule bg-surface"
              }`}
            >
              {done && <CheckIcon size={13} weight="bold" />}
            </span>
            <div className="min-w-0">
              <p className={`font-semibold ${done ? "" : "text-ink-3"} ${current ? "underline underline-offset-4" : ""}`}>
                {label(s)}
              </p>
              <p className="text-sm text-ink-2 tabular-nums">
                {when ? formatDateTime(when) : done ? "Data não registrada" : "—"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
