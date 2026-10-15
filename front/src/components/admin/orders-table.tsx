"use client";

import { CircleNotchIcon, FoldersIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  fetchOrderDownload,
  hasFolderPicker,
  labelStart,
  patchOrder,
  pickFolder,
  writeOrder,
  type DirectoryHandle,
} from "@/lib/admin-download";
import { formatBRL, formatDate } from "@/lib/format";
import { LABELS_PER_SHEET } from "@/lib/order-label";
import { canDownload } from "@/lib/order-rules";
import { reportError } from "@/lib/report-error";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const subscribeNoop = () => () => {};
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

/**
 * Lista de pedidos do painel: situação editável na linha, download em pastas por pedido ou em lote
 * (um seletor de pasta para todos), e o estado das imagens no bucket.
 */
export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const canPickFolder = useSyncExternalStore(subscribeNoop, hasFolderPicker, () => true);
  const savedStart = useSyncExternalStore(subscribeNoop, labelStart.get, () => 1);
  const [start, setStart] = useState<number | null>(null);
  const labelFrom = start ?? savedStart;

  const [pending, setPending] = useState<Record<string, OrderStatus>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const downloadable = orders.filter(canDownload);
  const chosen = downloadable.filter((o) => selected.has(o.id));
  const allChosen = downloadable.length > 0 && chosen.length === downloadable.length;

  async function saveStatus(order: Order) {
    const status = pending[order.id];
    if (!status || status === order.status) return;
    setSaving(order.id);
    const ok = await patchOrder(order.id, { status });
    setSaving(null);
    if (ok) {
      setPending((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
      setMessage(`Pedido #${order.number}: ${ORDER_STATUS_LABEL[status]}.`);
      router.refresh();
    } else {
      setMessage(`Não foi possível alterar o pedido #${order.number}.`);
    }
  }

  /** Grava um pedido em `root` e, se estava pago, passa para "Em produção". Devolve o que gravou. */
  async function downloadInto(root: DirectoryHandle, order: Order, from: number) {
    const note = (text: string) => setProgress((p) => ({ ...p, [order.id]: text }));
    note("Preparando…");
    try {
      const data = await fetchOrderDownload(order.id);
      const result = await writeOrder(root, data, {
        labelStart: from,
        onProgress: (done, total) => note(`${done} de ${total}`),
      });
      if (result.failed) {
        note(`${result.failed} falha(s)`);
      } else {
        note(`${result.files} arquivo(s)`);
        if (order.status === "paid") await patchOrder(order.id, { status: "in_production" });
      }
      return result;
    } catch (err) {
      reportError("loja", err, { etapa: "baixar pedido pela lista", order: order.id });
      note("Falhou");
      return null;
    }
  }

  async function downloadMany(list: Order[]) {
    if (!list.length) return;
    const root = await pickFolder();
    if (!root) return;
    setBusy(list.length === 1 ? list[0].id : "many");
    setMessage(null);
    let from = labelFrom;
    let ok = 0;
    let failed = 0;
    for (const order of list) {
      const result = await downloadInto(root, order, from);
      if (result && !result.failed) {
        ok += 1;
        from = labelStart.advance(from, result.labels);
      } else {
        failed += 1;
      }
    }
    labelStart.set(from);
    setStart(from);
    setBusy(null);
    setSelected(new Set());
    setMessage(
      failed
        ? `${ok} pedido(s) gravados, ${failed} com falha. Veja a coluna Imagens.`
        : `${ok} pedido(s) gravados em pastas, com etiquetas. Pedidos pagos passaram para "Em produção".`,
    );
    router.refresh();
  }

  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(downloadable.map((o) => o.id)));
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || !canPickFolder || chosen.length === 0}
          onClick={() => downloadMany(chosen)}
        >
          {busy === "many" ? <CircleNotchIcon size={18} className="spinner" aria-hidden /> : <FoldersIcon size={18} aria-hidden />}
          Baixar selecionados ({chosen.length})
        </button>
        <div>
          <label htmlFor="etiqueta-inicio" className="field-label">
            Próxima etiqueta livre
          </label>
          <input
            id="etiqueta-inicio"
            type="number"
            min={1}
            max={LABELS_PER_SHEET}
            value={labelFrom}
            onChange={(e) => {
              const n = Math.min(LABELS_PER_SHEET, Math.max(1, Number(e.target.value) || 1));
              setStart(n);
              labelStart.set(n);
            }}
            className="field-input w-24 tabular-nums"
          />
        </div>
        <p aria-live="polite" className="min-h-5 text-sm font-semibold">
          {message ?? (canPickFolder ? null : "Para baixar em pastas, abra o painel no Chrome ou no Edge do computador.")}
        </p>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left">
          <caption className="sr-only">Pedidos</caption>
          <thead className="border-b border-rule text-sm text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os pedidos que podem ser baixados"
                  className="size-4 accent-action"
                  checked={allChosen}
                  disabled={downloadable.length === 0}
                  onChange={toggleAll}
                />
              </th>
              {["Pedido", "Data", "Cliente", "Entrega", "Total", "Situação", "Imagens", ""].map((h, i) => (
                <th key={i} scope="col" className="px-3 py-3 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const pick = canDownload(order);
              const value = pending[order.id] ?? order.status;
              const changed = value !== order.status;
              return (
                <tr key={order.id} className="border-b border-rule last:border-0 hover:bg-paper">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar pedido ${order.number}`}
                      className="size-4 accent-action"
                      checked={selected.has(order.id)}
                      disabled={!pick || busy !== null}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(order.id);
                          else next.delete(order.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-action underline underline-offset-2">
                      #{order.number}
                    </Link>
                    {order.kind === "package" && <span className="block text-xs text-ink-2">Pacote</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatDate(order.created_at)}</td>
                  <td className="max-w-[14rem] truncate px-3 py-3" title={order.customer?.email}>
                    {order.customer?.name || order.customer?.email || "Sem nome"}
                  </td>
                  <td className="px-3 py-3">{order.shipping_label ?? (order.kind === "package" ? "Sem entrega" : "A definir")}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{formatBRL(order.total_cents)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Situação do pedido ${order.number}`}
                        className="field-input h-9 min-h-9 py-0 text-sm"
                        value={value}
                        disabled={saving === order.id}
                        onChange={(e) => setPending((p) => ({ ...p, [order.id]: e.target.value as OrderStatus }))}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      {changed && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={saving === order.id}
                          onClick={() => saveStatus(order)}
                        >
                          {saving === order.id && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
                          Salvar
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {order.kind !== "prints" ? (
                      <span className="text-ink-3">—</span>
                    ) : order.photos_deleted_at ? (
                      <span className="badge bg-paper text-ink-2">Apagadas</span>
                    ) : (
                      <span className="badge bg-success-soft text-success">No bucket</span>
                    )}
                    {progress[order.id] && <span className="block tabular-nums text-ink-2">{progress[order.id]}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {pick && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm whitespace-nowrap"
                        disabled={busy !== null || !canPickFolder}
                        onClick={() => downloadMany([order])}
                        aria-label={`Baixar pedido ${order.number} em pastas`}
                      >
                        {busy === order.id ? (
                          <CircleNotchIcon size={16} className="spinner" aria-hidden />
                        ) : (
                          <FoldersIcon size={16} aria-hidden />
                        )}
                        Baixar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        Baixar um pedido pago passa ele para em produção. Pendentes e cancelados não liberam download.
      </p>
    </div>
  );
}
