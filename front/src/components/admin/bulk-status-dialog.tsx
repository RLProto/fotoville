"use client";

import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { BulkStatus } from "@/lib/order-rules";
import { ORDER_STATUS_LABEL, type Order } from "@/lib/types";

/** "#1045, #1046 e #1047" */
function numberList(orders: Order[]) {
  const numbers = orders.map((o) => `#${o.number}`);
  return numbers.length > 1 ? `${numbers.slice(0, -1).join(", ")} e ${numbers.at(-1)}` : numbers[0];
}

function question(status: BulkStatus, orders: Order[]) {
  const one = orders.length === 1;
  if (status === "cancelled") return one ? `Cancelar o pedido #${orders[0].number}?` : `Cancelar ${orders.length} pedidos?`;
  const target = ORDER_STATUS_LABEL[status];
  return one ? `Mudar o pedido #${orders[0].number} para ${target}?` : `Mudar ${orders.length} pedidos para ${target}?`;
}

/**
 * Confirma a mudança de status em massa e a aplica. Se tudo mudou, fecha sozinho: a lista já mostra.
 * Só fica aberto para dizer o que não mudou.
 */
export function BulkStatusDialog({
  status,
  orders,
  onApplied,
  onClose,
}: {
  status: BulkStatus;
  orders: Order[];
  onApplied: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [missed, setMissed] = useState<Order[] | null>(null);
  const cancelling = status === "cancelled";
  const changed = missed ? orders.filter((o) => !missed.includes(o)) : [];

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function apply() {
    setSaving(true);
    setFailed(false);
    const res = await fetch("/api/admin/pedidos/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orders.map((o) => o.id), status }),
    }).catch(() => null);
    const body: { updated?: string[] } | null = res?.ok ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (!body?.updated) {
      setFailed(true);
      return;
    }
    const updated = new Set(body.updated);
    onApplied(body.updated);
    const rest = orders.filter((o) => !updated.has(o.id));
    if (rest.length) setMissed(rest);
    else dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="status-massa-titulo"
      onCancel={(e) => {
        if (saving) e.preventDefault();
      }}
      onClose={onClose}
      className="m-auto w-[min(100vw-1.5rem,26rem)] max-w-none rounded-panel bg-surface p-6 shadow-lift outline-none backdrop:bg-ink/70"
    >
      {missed ? (
        <div role="status">
          <h2 id="status-massa-titulo" className="flex items-center gap-2 text-lg font-bold">
            <WarningCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-danger" />
            {changed.length ? "Nem todos os pedidos mudaram" : "Nenhum pedido mudou"}
          </h2>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-ink-2">
            {changed.length > 0 && (
              <p>
                {numberList(changed)} {changed.length === 1 ? "mudou" : "mudaram"} para {ORDER_STATUS_LABEL[status]}.
              </p>
            )}
            <p>
              {numberList(missed)} {missed.length === 1 ? "não mudou" : "não mudaram"} porque o status já era outro.
            </p>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 id="status-massa-titulo" className="text-lg font-bold">
            {question(status, orders)}
          </h2>
          {orders.length > 1 && <p className="mt-2 max-h-48 overflow-y-auto text-ink-2">Pedidos {numberList(orders)}.</p>}
          {failed && (
            <p role="alert" className="mt-2 font-semibold text-danger">
              Não foi possível mudar. Tente de novo.
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-outline" disabled={saving} onClick={() => dialogRef.current?.close()}>
              Voltar
            </button>
            <button
              type="button"
              className={`btn ${cancelling ? "bg-danger text-white hover:bg-danger/90" : "btn-primary"}`}
              disabled={saving}
              onClick={apply}
            >
              {saving && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
              {cancelling ? (orders.length === 1 ? "Cancelar pedido" : "Cancelar pedidos") : "Mudar"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
