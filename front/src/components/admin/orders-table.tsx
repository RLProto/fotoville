"use client";

import { ArrowSquareOutIcon, CircleNotchIcon, FoldersIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  fetchOrderDownload,
  hasFolderPicker,
  markDownloaded,
  patchOrder,
  pickFolder,
  writeOrder,
  type DirectoryHandle,
} from "@/lib/admin-download";
import { BulkStatusDialog } from "@/components/admin/bulk-status-dialog";
import { DownloadDialog, downloadResult, type DownloadState } from "@/components/admin/download-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { BULK_STATUSES, canBulkChange, canDownload, canPickStatus, type BulkStatus } from "@/lib/order-rules";
import { reportError } from "@/lib/report-error";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const subscribeNoop = () => () => {};
type SearchKind = "number" | "customer";

/** Cor de cada situação na linha: faixa à esquerda e fundo da mesma cor, além do texto no seletor. */
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#8a8f9c", // cinza
  paid: "#f2b705", // amarelo
  in_production: "#7ed957", // verde claro
  ready_for_pickup: "#1f7a3c", // verde escuro
  shipped: "#13a3b8", // azul-petróleo
  delivered: "#2f6fde", // azul
  cancelled: "#e0352b", // vermelho
};
const ROW_TONE = Object.fromEntries(
  (Object.keys(STATUS_COLOR) as OrderStatus[]).map((status) => [
    status,
    { stripe: STATUS_COLOR[status], tint: `color-mix(in srgb, ${STATUS_COLOR[status]} 18%, white)` },
  ]),
) as Record<OrderStatus, { stripe: string; tint: string }>;
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

/**
 * Lista de pedidos do painel: situação editável na linha, download em pastas por pedido, ações em massa
 * nos selecionados (download com um seletor de pasta para todos e status), e o estado das imagens no bucket.
 */
export function OrdersTable({ orders: all }: { orders: Order[] }) {
  const router = useRouter();
  // Busca pelo cabeçalho da coluna: número do pedido ou nome/e-mail do cliente, sem recarregar
  const [searching, setSearching] = useState<SearchKind | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const orders =
    !searching || !q
      ? all
      : all.filter((o) =>
          searching === "number"
            ? String(o.number).startsWith(q.replace("#", ""))
            : `${o.customer?.name ?? ""} ${o.customer?.email ?? ""}`.toLowerCase().includes(q),
        );
  function openSearch(kind: SearchKind) {
    setSearching(kind);
    setQuery("");
    setTimeout(() => searchRef.current?.focus(), 0);
  }
  function closeSearch() {
    setSearching(null);
    setQuery("");
  }
  const canPickFolder = useSyncExternalStore(subscribeNoop, hasFolderPicker, () => true);

  const [pending, setPending] = useState<Record<string, OrderStatus>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [bulkTarget, setBulkTarget] = useState<BulkStatus | "">("");
  const [bulk, setBulk] = useState<{ status: BulkStatus; orders: Order[] } | null>(null);

  // Só o que está na tela: a busca não deixa uma ação pegar pedido escondido
  const chosen = orders.filter((o) => selected.has(o.id));
  const allChosen = orders.length > 0 && chosen.length === orders.length;
  const toDownload = chosen.filter(canDownload);
  const bulkOptions = BULK_STATUSES.map((status) => ({
    status,
    count: chosen.filter((o) => canBulkChange(o, status)).length,
  })).filter((option) => option.count > 0);
  const target = bulkOptions.some((option) => option.status === bulkTarget) ? bulkTarget : "";

  function openBulk() {
    if (!target) return;
    setBulk({ status: target, orders: chosen.filter((o) => canBulkChange(o, target)) });
  }

  function bulkApplied(ids: string[]) {
    setSelected(new Set());
    setBulkTarget("");
    setPending((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
    router.refresh();
  }

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
      router.refresh();
    }
  }

  /** Grava um pedido em `root`, libera a etiqueta e, se estava pago, passa para "Em produção". */
  async function downloadInto(root: DirectoryHandle, order: Order, title: string) {
    setDownload({ phase: "running", title, done: 0, total: 0 });
    try {
      const data = await fetchOrderDownload(order.id);
      const result = await writeOrder(root, data, {
        onProgress: (done, total) => setDownload({ phase: "running", title, done, total }),
      });
      return !result.failed && (await markDownloaded(order));
    } catch (err) {
      reportError("loja", err, { etapa: "baixar pedido pela lista", order: order.id });
      return false;
    }
  }

  async function downloadMany(list: Order[]) {
    if (!list.length) return;
    const root = await pickFolder();
    if (!root) return;
    setBusy(list.length === 1 ? list[0].id : "many");
    setMessage(null);
    let saved = 0;
    const failed: number[] = [];
    for (const [i, order] of list.entries()) {
      const place = list.length > 1 ? ` (${i + 1} de ${list.length})` : "";
      if (await downloadInto(root, order, `Baixando pedido #${order.number}${place}`)) saved += 1;
      else failed.push(order.number);
    }
    setBusy(null);
    setSelected(new Set());
    setDownload(downloadResult(saved, failed));
    router.refresh();
  }

  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(orders.map((o) => o.id)));
  }

  return (
    <div>
      <p aria-live="polite" className="mt-6 min-h-5 text-sm font-semibold">
        {message ??
          (canPickFolder ? null : "Para baixar em pastas, abra o painel no Chrome ou no Edge do computador.")}
      </p>

      <div className="card mt-2 overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <caption className="sr-only">Pedidos</caption>
          <thead className="border-b border-rule text-sm text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os pedidos"
                  className="size-4 accent-action"
                  ref={(el) => {
                    if (el) el.indeterminate = chosen.length > 0 && !allChosen;
                  }}
                  checked={allChosen}
                  disabled={orders.length === 0 || busy !== null}
                  onChange={toggleAll}
                />
              </th>
              <SearchHeader
                label="Pedido"
                kind="number"
                placeholder="Nº"
                searching={searching}
                query={query}
                inputRef={searchRef}
                onOpen={openSearch}
                onChange={setQuery}
                onClose={closeSearch}
              />
              <th scope="col" className="px-3 py-2 font-bold">
                Data
              </th>
              <SearchHeader
                label="Cliente"
                kind="customer"
                placeholder="Nome ou e-mail"
                searching={searching}
                query={query}
                inputRef={searchRef}
                onOpen={openSearch}
                onChange={setQuery}
                onClose={closeSearch}
              />
              {["Entrega", "Total", "Status", "Imagens", ""].map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-2">
                  Nenhum pedido para &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const pick = canDownload(order);
              const value = pending[order.id] ?? order.status;
              const changed = value !== order.status;
              return (
                <tr
                  key={order.id}
                  className="border-b border-rule last:border-0"
                  style={{ background: ROW_TONE[order.status].tint }}
                >
                  <td className="px-3 py-1.5" style={{ boxShadow: `inset 4px 0 0 ${ROW_TONE[order.status].stripe}` }}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar pedido ${order.number}`}
                      className="size-4 accent-action"
                      checked={selected.has(order.id)}
                      disabled={busy !== null}
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
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="font-bold text-action underline underline-offset-2"
                    >
                      #{order.number}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{formatDate(order.created_at)}</td>
                  <td className="max-w-[13rem] truncate px-3 py-1.5" title={order.customer?.email}>
                    {order.customer?.name || order.customer?.email || "Sem nome"}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {order.shipping_label ?? (order.kind === "package" ? "Sem entrega" : "A definir")}
                  </td>
                  <td className="px-3 py-1.5 font-semibold whitespace-nowrap tabular-nums">{formatBRL(order.total_cents)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Status do pedido ${order.number}`}
                        className="field-input h-8 min-h-8 min-w-[12.5rem] py-0 text-sm"
                        value={value}
                        disabled={saving === order.id}
                        onChange={(e) => setPending((p) => ({ ...p, [order.id]: e.target.value as OrderStatus }))}
                      >
                        {STATUSES.filter((s) => canPickStatus(order.status, s)).map((s) => (
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
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {order.kind !== "prints" ? (
                      <span className="text-ink-3">—</span>
                    ) : order.photos_deleted_at ? (
                      <span className="badge bg-paper text-ink-2">Apagadas</span>
                    ) : (
                      <span className="badge bg-success-soft text-success">No servidor</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      {pick && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm whitespace-nowrap"
                          disabled={busy !== null || !canPickFolder}
                          onClick={() => downloadMany([order])}
                          aria-label={`Baixar pedido ${order.number} em pastas`}
                          title="Baixar em pastas"
                        >
                          {busy === order.id ? (
                            <CircleNotchIcon size={16} className="spinner" aria-hidden />
                          ) : (
                            <FoldersIcon size={16} aria-hidden />
                          )}
                          Baixar
                        </button>
                      )}
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="inline-flex size-9 items-center justify-center rounded-control text-ink-2 hover:bg-action-soft hover:text-action"
                        aria-label={`Detalhes do pedido ${order.number}`}
                        title="Detalhes"
                      >
                        <ArrowSquareOutIcon size={18} aria-hidden />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fixa no rodapé: a lista pode ter centenas de linhas */}
      {chosen.length > 0 && (
        <section
          aria-label="Ações nos pedidos selecionados"
          className="card sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 p-3 shadow-lift"
        >
          {/* Tudo à esquerda: o botão do WhatsApp fica sobre o canto direito da barra */}
          <div className="flex items-center gap-1">
            <p className="font-bold tabular-nums">
              {chosen.length} {chosen.length === 1 ? "selecionado" : "selecionados"}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setSelected(new Set())}>
              Limpar
            </button>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy !== null || !canPickFolder || toDownload.length === 0}
            onClick={() => downloadMany(toDownload)}
          >
            {busy === "many" ? (
              <CircleNotchIcon size={16} className="spinner" aria-hidden />
            ) : (
              <FoldersIcon size={16} aria-hidden />
            )}
            Baixar fotos ({toDownload.length})
          </button>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              openBulk();
            }}
          >
            <label htmlFor="status-em-massa" className="text-sm font-semibold">
              Mudar para
            </label>
            <select
              id="status-em-massa"
              className="field-input h-10 min-h-10 w-auto min-w-[14rem] py-0 text-sm"
              value={target}
              disabled={busy !== null || bulkOptions.length === 0}
              onChange={(e) => setBulkTarget(e.target.value as BulkStatus | "")}
            >
              <option value="">{bulkOptions.length ? "Escolha o status" : "Nenhum status disponível"}</option>
              {bulkOptions.map(({ status, count }) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABEL[status]}
                  {count < chosen.length ? ` (${count} de ${chosen.length})` : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy !== null || !target}>
              Aplicar
            </button>
          </form>
        </section>
      )}

      {bulk && (
        <BulkStatusDialog
          status={bulk.status}
          orders={bulk.orders}
          onApplied={bulkApplied}
          onClose={() => setBulk(null)}
        />
      )}
      {download && <DownloadDialog state={download} onClose={() => setDownload(null)} />}
    </div>
  );
}

/** Cabeçalho de coluna com lupa: clicado, vira um campo de busca na própria coluna. */
function SearchHeader({
  label,
  kind,
  placeholder,
  searching,
  query,
  inputRef,
  onOpen,
  onChange,
  onClose,
}: {
  label: string;
  kind: SearchKind;
  placeholder: string;
  searching: SearchKind | null;
  query: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpen: (kind: SearchKind) => void;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const open = searching === kind;
  return (
    <th scope="col" className="px-3 py-2 font-bold">
      {open ? (
        <div className="relative">
          <MagnifyingGlassIcon
            size={16}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-2"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            aria-label={`Buscar por ${label.toLowerCase()}`}
            placeholder={placeholder}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            className="field-input h-9 min-h-9 w-44 py-0 pr-9 pl-8 text-sm font-normal"
            autoComplete="off"
          />
          <button
            type="button"
            aria-label="Fechar busca"
            onClick={onClose}
            className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-control hover:bg-action-soft"
          >
            <XIcon size={14} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(kind)}
          aria-label={`Buscar por ${label.toLowerCase()}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-1 font-bold hover:text-action"
        >
          {label}
          <MagnifyingGlassIcon size={15} className="text-ink-2" aria-hidden />
        </button>
      )}
    </th>
  );
}
