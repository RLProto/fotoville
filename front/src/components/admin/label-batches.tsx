"use client";

import { CaretLeftIcon, CaretRightIcon, CircleNotchIcon, FoldersIcon, PrinterIcon, TagIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PrintLabelsDialog, type PrintJob } from "@/components/admin/print-labels-dialog";
import { useOrderDownloads, type DownloadTarget } from "@/components/admin/use-order-downloads";
import { hasFolderPicker } from "@/lib/admin-download";
import { formatDateTime, plural } from "@/lib/format";
import type { BatchOrder, BatchView } from "@/lib/label-batches";
import { buildLabelsPdf, type LabelData } from "@/lib/order-label";
import { reportError } from "@/lib/report-error";

const subscribeNoop = () => () => {};
/** Pedidos que o cartão mostra antes de "mais N pedidos". */
const ORDERS_SHOWN = 4;

const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** "hoje, 14:32", "ontem, 09:10" ou "em 12/11, 10:00". */
function when(iso: string) {
  const date = new Date(iso);
  const day = dayKey.format(date);
  if (day === dayKey.format(new Date())) return `hoje, ${clock.format(date)}`;
  if (day === dayKey.format(new Date(Date.now() - 86_400_000))) return `ontem, ${clock.format(date)}`;
  return `em ${formatDateTime(iso)}`;
}

/** Página de lotes que a tela mostra; `first` é a posição do primeiro lote, para "1–30 de 45". */
type Page = { current: number; count: number; total: number; first: number };

const pageHref = (n: number) => (n > 1 ? `/admin/etiquetas?pagina=${n}` : "/admin/etiquetas");

/** `quiet`: só para leitor de tela, quando a própria lista já mostra o resultado. */
type Message = { text: string; error?: boolean; quiet?: boolean };

/**
 * Lotes de etiquetas: "Gerar etiquetas" junta os pedidos aprovados num lote; o lote abre o PDF para imprimir e,
 * impresso, oferece baixar as fotos dos pedidos. 30 lotes por página.
 */
export function LabelBatches({ batches, waiting, page }: { batches: BatchView[]; waiting: number; page: Page }) {
  const router = useRouter();
  const downloads = useOrderDownloads();
  const canPickFolder = useSyncExternalStore(subscribeNoop, hasFolderPicker, () => true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  /** Lote em andamento: montando o PDF ou desfazendo. */
  const [working, setWorking] = useState<string | null>(null);
  const [printing, setPrinting] = useState<PrintJob | null>(null);
  /** Lote cujas fotos estão sendo baixadas, para o indicador ficar no cartão certo. */
  const [downloadFrom, setDownloadFrom] = useState<string | null>(null);
  const locked = creating || working !== null || downloads.busy !== null;

  async function generate() {
    setCreating(true);
    setMessage(null);
    const res = await fetch("/api/admin/etiquetas", { method: "POST" }).catch(() => null);
    const body: { batch?: { id: string; number: number; orders: number }; error?: string } | null = res
      ? await res.json().catch(() => null)
      : null;
    setCreating(false);
    if (!body?.batch) {
      setMessage({ text: body?.error ?? "Não foi possível gerar as etiquetas. Tente de novo.", error: true });
      router.refresh();
      return;
    }
    setFresh(body.batch.id);
    setMessage({ text: `Lote ${body.batch.number} gerado com ${plural(body.batch.orders, "pedido", "pedidos")}.`, quiet: true });
    // O lote novo entra no topo da primeira página
    if (page.current > 1) router.push(pageHref(1));
    else router.refresh();
  }

  async function openPrint(batch: BatchView) {
    // Sem leitor de PDF na página (celular), o PDF vai para outra aba, aberta já no clique para não ser barrada
    const external = navigator.pdfViewerEnabled === false;
    const tab = external ? window.open("", "_blank") : null;
    setWorking(batch.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/etiquetas/${batch.id}`);
      const body: { labels?: LabelData[]; error?: string } | null = await res.json().catch(() => null);
      if (!res.ok || !body?.labels) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (!body.labels.length) {
        tab?.close();
        setMessage({ text: `O lote ${batch.number} não tem etiquetas: os pedidos foram cancelados.`, error: true });
        return;
      }
      const pdf = await buildLabelsPdf(body.labels);
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      if (tab) tab.location.href = url;
      setPrinting({ batch, url, labels: body.labels.length, external });
    } catch (err) {
      tab?.close();
      reportError("loja", err, { etapa: "abrir etiquetas do lote", lote: batch.id });
      setMessage({ text: "Não foi possível abrir as etiquetas. Tente de novo.", error: true });
    } finally {
      setWorking(null);
    }
  }

  function closePrint() {
    const url = printing?.url;
    setPrinting(null);
    // A aba aberta no celular ainda pode estar carregando o PDF
    if (url) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function undo(batch: BatchView) {
    setWorking(batch.id);
    setMessage(null);
    const res = await fetch(`/api/admin/etiquetas/${batch.id}`, { method: "DELETE" }).catch(() => null);
    const body: { error?: string } | null = res ? await res.json().catch(() => null) : null;
    setWorking(null);
    setMessage(
      res?.ok
        ? { text: `Lote ${batch.number} desfeito.` }
        : { text: body?.error ?? "Não foi possível desfazer o lote. Tente de novo.", error: true },
    );
    router.refresh();
  }

  async function download(batchId: string, orders: DownloadTarget[]) {
    setMessage(null);
    setDownloadFrom(batchId);
    await downloads.run(orders);
    setDownloadFrom(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="display-md text-3xl">Etiquetas</h1>
        <button type="button" className="btn btn-primary" disabled={!waiting || locked} onClick={generate}>
          {creating ? <CircleNotchIcon size={18} className="spinner" aria-hidden /> : <TagIcon size={18} aria-hidden />}
          Gerar etiquetas
        </button>
      </div>
      <p
        aria-live="polite"
        className={message && !message.quiet ? `mt-4 text-sm font-semibold ${message.error ? "text-danger" : ""}` : "sr-only"}
      >
        {message?.text}
      </p>

      {batches.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-ink-2">Nenhum lote ainda.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              fresh={batch.id === fresh}
              working={working === batch.id}
              downloading={downloadFrom === batch.id && downloads.busy !== null}
              locked={locked}
              canPickFolder={canPickFolder}
              onPrint={() => openPrint(batch)}
              onUndo={() => undo(batch)}
              onDownload={(orders) => download(batch.id, orders)}
            />
          ))}
        </div>
      )}

      {page.count > 1 && (
        <nav aria-label="Páginas de lotes" className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <PageLink to={page.current - 1} disabled={page.current === 1 || locked}>
            <CaretLeftIcon size={16} aria-hidden />
            Anterior
          </PageLink>
          <p className="text-sm tabular-nums">
            {page.first}–{page.first + batches.length - 1} de {page.total}
          </p>
          <PageLink to={page.current + 1} disabled={page.current === page.count || locked}>
            Próxima
            <CaretRightIcon size={16} aria-hidden />
          </PageLink>
        </nav>
      )}

      {printing && (
        <PrintLabelsDialog
          job={printing}
          canPickFolder={canPickFolder}
          onPrinted={() => router.refresh()}
          onDownload={(orders) => {
            const id = printing.batch.id;
            closePrint();
            download(id, orders);
          }}
          onClose={closePrint}
        />
      )}
      {downloads.dialogs}
    </div>
  );
}

/** Botão de página: link de verdade, ou só aparência quando não há para onde ir. */
function PageLink({ to, disabled, children }: { to: number; disabled: boolean; children: React.ReactNode }) {
  return disabled ? (
    <span className="btn btn-outline btn-sm pointer-events-none opacity-50" aria-disabled="true">
      {children}
    </span>
  ) : (
    <Link href={pageHref(to)} className="btn btn-outline btn-sm">
      {children}
    </Link>
  );
}

function BatchCard({
  batch,
  fresh,
  working,
  downloading,
  locked,
  canPickFolder,
  onPrint,
  onUndo,
  onDownload,
}: {
  batch: BatchView;
  fresh: boolean;
  working: boolean;
  downloading: boolean;
  locked: boolean;
  canPickFolder: boolean;
  onPrint: () => void;
  onUndo: () => Promise<void>;
  onDownload: (orders: DownloadTarget[]) => void;
}) {
  const [undoing, setUndoing] = useState(false);
  const live = batch.orders.filter((o) => o.status !== "cancelled");
  const downloadable = batch.orders.filter((o) => o.downloadable);
  const downloaded = downloadable.filter((o) => o.downloaded).length;
  const pending = downloadable.filter((o) => !o.downloaded);
  const shown = batch.orders.slice(0, ORDERS_SHOWN);
  const rest = batch.orders.slice(ORDERS_SHOWN);
  const target = (o: BatchOrder): DownloadTarget => ({ id: o.id, number: o.number, status: o.status });
  const titleId = `lote-${batch.number}`;

  return (
    <article aria-labelledby={titleId} className={`card p-5 sm:p-6 ${fresh ? "fresh" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-lg font-bold">
          Lote {batch.number}
        </h2>
        <p className="text-sm text-ink-2" suppressHydrationWarning>
          {batch.printedAt ? `Impresso ${when(batch.printedAt)}` : `Gerado ${when(batch.createdAt)}`}
        </p>
      </div>
      <p className="text-sm text-ink-2">
        {plural(live.length, "pedido", "pedidos")}, {plural(batch.labels, "etiqueta", "etiquetas")}
      </p>

      <ul className="mt-3 border-t border-rule">
        {shown.map((order) => (
          <OrderLine key={order.id} order={order} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="link inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold marker:content-none">
            <span className="group-open:hidden">mais {plural(rest.length, "pedido", "pedidos")}</span>
            <span className="hidden group-open:inline">mostrar menos</span>
          </summary>
          <ul className="border-t border-rule">
            {rest.map((order) => (
              <OrderLine key={order.id} order={order} />
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {!batch.printedAt ? (
          <>
            <button type="button" className="btn btn-primary" disabled={locked || !live.length} onClick={onPrint}>
              {working && !undoing ? (
                <CircleNotchIcon size={18} className="spinner" aria-hidden />
              ) : (
                <PrinterIcon size={18} aria-hidden />
              )}
              Imprimir etiquetas
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={locked}
              onClick={async () => {
                setUndoing(true);
                await onUndo();
                setUndoing(false);
              }}
            >
              {undoing && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
              Desfazer lote
            </button>
          </>
        ) : (
          <>
            {downloadable.length > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={locked || !canPickFolder}
                title={canPickFolder ? undefined : "Abra o painel no Chrome ou no Edge do computador"}
                onClick={() => onDownload((pending.length ? pending : downloadable).map(target))}
              >
                {downloading ? (
                  <CircleNotchIcon size={18} className="spinner" aria-hidden />
                ) : (
                  <FoldersIcon size={18} aria-hidden />
                )}
                {pending.length ? "Baixar fotos" : "Baixar de novo"}
              </button>
            )}
            {downloadable.length > 0 && (
              <span className="text-sm text-ink-2 tabular-nums">
                {pending.length ? `${downloaded} de ${downloadable.length} baixados` : "Fotos baixadas"}
              </span>
            )}
            <button type="button" className="btn btn-ghost sm:ml-auto" disabled={locked || !live.length} onClick={onPrint}>
              {working && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
              Imprimir de novo
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function OrderLine({ order }: { order: BatchOrder }) {
  const cancelled = order.status === "cancelled";
  return (
    <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-rule py-2 text-sm sm:grid-cols-[4.25rem_minmax(0,1fr)_auto]">
      <Link href={`/admin/pedidos/${order.id}`} className="link font-semibold tabular-nums">
        #{order.number}
      </Link>
      <span className={`break-words ${cancelled ? "text-ink-3 line-through" : ""}`}>
        {order.customer}
        {order.note && <span className="text-ink-2"> ({order.note})</span>}
      </span>
      <span className="col-start-2 text-ink-2 sm:col-start-auto">{cancelled ? "Cancelado" : order.place}</span>
    </li>
  );
}
