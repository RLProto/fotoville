"use client";

import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { numberList } from "@/components/admin/bulk-status-dialog";
import { BULK_DELETABLE } from "@/lib/order-rules";
import type { Order } from "@/lib/types";

const plural = (orders: Order[], singular: string, many: string) => (orders.length === 1 ? singular : many);

/**
 * Confirma e apaga as imagens dos pedidos selecionados que ainda as têm no servidor. Só apaga as de
 * pedidos entregues, prontos para retirada ou cancelados; os outros aparecem no popup e ficam como estão.
 * Se tudo foi apagado, fecha sozinho: a coluna Imagens já mostra.
 */
export function BulkDeleteDialog({
  orders,
  onDeleted,
  onClose,
}: {
  orders: Order[];
  onDeleted: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [missed, setMissed] = useState<Order[] | null>(null);
  const deletable = orders.filter((o) => BULK_DELETABLE.includes(o.status));
  const kept = orders.filter((o) => !BULK_DELETABLE.includes(o.status));

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function apply() {
    setSaving(true);
    setFailed(false);
    const res = await fetch("/api/admin/pedidos/fotos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: deletable.map((o) => o.id) }),
    }).catch(() => null);
    const body: { deleted?: string[] } | null = res?.ok ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (!body?.deleted) {
      setFailed(true);
      return;
    }
    const deleted = new Set(body.deleted);
    onDeleted(body.deleted);
    const rest = deletable.filter((o) => !deleted.has(o.id));
    if (rest.length) setMissed(rest);
    else dialogRef.current?.close();
  }

  const close = () => dialogRef.current?.close();
  const keptNote = kept.length > 0 && (
    <p>
      {numberList(kept)}{" "}
      {plural(kept, "não está entregue, pronto para retirada ou cancelado", "não estão entregues, prontos para retirada ou cancelados")}
      . As fotos {plural(kept, "dele", "deles")} ficam no servidor.
    </p>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="apagar-massa-titulo"
      onCancel={(e) => {
        if (saving) e.preventDefault();
      }}
      onClose={onClose}
      className="m-auto w-[min(100vw-1.5rem,26rem)] max-w-none rounded-panel bg-surface p-6 shadow-lift outline-none backdrop:bg-ink/70"
    >
      {missed || deletable.length === 0 ? (
        <div role="status">
          <h2 id="apagar-massa-titulo" className="flex items-center gap-2 text-lg font-bold">
            <WarningCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-danger" />
            {missed && missed.length < deletable.length ? "Nem todas as fotos foram apagadas" : "Nenhuma foto apagada"}
          </h2>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-ink-2">
            {missed ? (
              <p>
                Não foi possível apagar as fotos {plural(missed, "do pedido", "dos pedidos")} {numberList(missed)}. Tente
                de novo.
              </p>
            ) : (
              keptNote
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn btn-outline" onClick={close}>
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 id="apagar-massa-titulo" className="text-lg font-bold">
            {deletable.length === 1
              ? `Apagar as fotos do pedido #${deletable[0].number}?`
              : `Apagar as fotos de ${deletable.length} pedidos?`}
          </h2>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-ink-2">
            {deletable.length > 1 && <p>Pedidos {numberList(deletable)}.</p>}
            {keptNote}
          </div>
          {failed && (
            <p role="alert" className="mt-2 font-semibold text-danger">
              Não foi possível apagar. Tente de novo.
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-outline" disabled={saving} onClick={close}>
              Voltar
            </button>
            <button type="button" className="btn bg-danger text-white hover:bg-danger/90" disabled={saving} onClick={apply}>
              {saving && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
              Apagar fotos
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
