"use client";

import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { BulkStatus } from "@/lib/order-rules";
import { ORDER_STATUS_LABEL, type Order } from "@/lib/types";

const NUMBERS_SHOWN = 8;

/** "#1045, #1046 e mais 3": a seleção pode ter centenas de pedidos. */
function numberList(orders: Order[]) {
  const shown = orders
    .slice(0, NUMBERS_SHOWN)
    .map((o) => `#${o.number}`)
    .join(", ");
  return orders.length > NUMBERS_SHOWN ? `${shown} e mais ${orders.length - NUMBERS_SHOWN}` : shown;
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
  leftOut,
  onApplied,
  onClose,
}: {
  status: BulkStatus;
  orders: Order[];
  leftOut: Order[];
  onApplied: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [missed, setMissed] = useState<Order[] | null>(null);
  const cancelling = status === "cancelled";

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
            {orders.length - missed.length} de {orders.length} pedidos alterados
          </h2>
          <p className="mt-2 text-ink-2">
            {numberList(missed)} {missed.length === 1 ? "não mudou" : "não mudaram"}: o status já era outro.
          </p>
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
          {leftOut.length > 0 && <p className="mt-2 text-ink-2">Ficam de fora: {numberList(leftOut)}.</p>}
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
