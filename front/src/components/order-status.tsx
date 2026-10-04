import { CheckIcon } from "@phosphor-icons/react/ssr";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const TONE: Record<OrderStatus, string> = {
  pending: "bg-warning-soft text-warning",
  paid: "bg-success-soft text-success",
  in_production: "bg-action-soft text-ink",
  shipped: "bg-action-soft text-ink",
  ready_for_pickup: "bg-action-soft text-ink",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge px-3 py-1 text-sm ${TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

/** Linha do tempo do pedido. O estado é dito em texto, não só por cor. */
export function OrderTimeline({ order }: { order: Pick<Order, "status" | "kind" | "shipping_service"> }) {
  if (order.status === "cancelled") return null;

  const steps: { status: OrderStatus; label: string }[] =
    order.kind === "package"
      ? [
          { status: "pending", label: "Pedido criado" },
          { status: "paid", label: "Pagamento aprovado" },
        ]
      : [
          { status: "pending", label: "Pedido criado" },
          { status: "paid", label: "Pagamento aprovado" },
          { status: "in_production", label: "Em produção" },
          order.shipping_service === "retirada"
            ? { status: "ready_for_pickup", label: "Pronto para retirada" }
            : { status: "shipped", label: "Enviado" },
          { status: "delivered", label: order.shipping_service === "retirada" ? "Retirado" : "Entregue" },
        ];

  const current = Math.max(
    0,
    steps.findIndex((s) => s.status === order.status),
  );

  return (
    <ol className="grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
      {steps.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step.status} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                done ? "bg-action text-white" : "border-2 border-rule bg-surface text-ink-2"
              }`}
              aria-hidden
            >
              {done ? <CheckIcon size={16} /> : i + 1}
            </span>
            <span className={done ? "font-bold" : "text-ink-2"}>
              {step.label}
              <span className="sr-only">{done ? " (concluído)" : " (pendente)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
