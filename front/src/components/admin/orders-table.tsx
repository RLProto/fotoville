"use client";

import { CircleNotchIcon, FoldersIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  fetchOrderDownload,
  hasFolderPicker,
  patchOrder,
  pickFolder,
  writeOrder,
  type DirectoryHandle,
} from "@/lib/admin-download";
import { formatBRL, formatDate } from "@/lib/format";
import { canDownload } from "@/lib/order-rules";
import { reportError } from "@/lib/report-error";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const subscribeNoop = () => () => {};
type SearchKind = "number" | "customer";
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

/**
 * Lista de pedidos do painel: situação editável na linha, download em pastas por pedido ou em lote
 * (um seletor de pasta para todos), e o estado das imagens no bucket.
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
  async function downloadInto(root: DirectoryHandle, order: Order) {
    const note = (text: string) => setProgress((p) => ({ ...p, [order.id]: text }));
    note("Preparando…");
    try {
      const data = await fetchOrderDownload(order.id);
      const result = await writeOrder(root, data, {
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
    let ok = 0;
    let failed = 0;
    for (const order of list) {
      const result = await downloadInto(root, order);
      if (result && !result.failed) {
        ok += 1;
      } else {
        failed += 1;
      }
    }
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
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || !canPickFolder || chosen.length === 0}
          onClick={() => downloadMany(chosen)}
        >
          {busy === "many" ? <CircleNotchIcon size={18} className="spinner" aria-hidden /> : <FoldersIcon size={18} aria-hidden />}
          Baixar selecionados ({chosen.length})
        </button>
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
              <th scope="col" className="px-3 py-3 font-bold">
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
              {["Entrega", "Total", "Situação", "Imagens", ""].map((h, i) => (
                <th key={i} scope="col" className="px-3 py-3 font-bold">
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
                      <span className="badge bg-success-soft text-success">No servidor</span>
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
