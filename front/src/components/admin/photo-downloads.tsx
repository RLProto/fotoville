"use client";

import { CircleNotchIcon, DownloadSimpleIcon, FoldersIcon, ScissorsIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PrintPreview } from "@/components/print-preview";
import {
  countFiles,
  hasFolderPicker,
  patchOrder,
  pickFolder,
  sizeName,
  writeOrder,
  type AdminPhoto,
  type OrderDownload,
} from "@/lib/admin-download";
import { describeAdjust } from "@/lib/adjust";
import { realSizeLabel } from "@/lib/catalog-data";
import { formatDate } from "@/lib/format";
import { canDeletePhotos, canDownload, downloadBlockedReason } from "@/lib/order-rules";
import { renderPrintFileFromUrl } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const subscribeNoop = () => () => {};

/** Fotos do pedido no painel: download em pastas com etiquetas, arquivo avulso, original, e limpeza do bucket. */
export function PhotoDownloads({ data }: { data: OrderDownload }) {
  const { order, photos, products } = data;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // No servidor não há window nem localStorage: assume o padrão, e o navegador corrige ao montar.
  const canPickFolder = useSyncExternalStore(subscribeNoop, hasFolderPicker, () => true);

  const productOf = (p: AdminPhoto) => products.find((x) => x.id === p.product_id);
  const downloadable = canDownload(order);
  const blocked = downloadBlockedReason(order);
  const files = downloadable ? countFiles(data) : 0;

  async function downloadOne(photo: AdminPhoto) {
    const product = productOf(photo);
    if (!product || !photo.original_url) return;
    save(await renderPrintFileFromUrl(photo.original_url, photo, product), `${photo.base_name}.jpg`);
  }

  /** Grava o pedido numa pasta do computador e, se estava pago, passa para "Em produção". */
  async function downloadFolder() {
    const root = await pickFolder();
    if (!root) return;
    setBusy("all");
    setMessage(null);
    const result = await writeOrder(root, data, {
      onProgress: (done, total) => setMessage(`${done} de ${total} arquivos gravados…`),
    }).catch((err) => {
      reportError("loja", err, { etapa: "baixar pedido em pastas", order: order.id });
      return null;
    });
    if (!result) {
      setBusy(null);
      setMessage("Não foi possível gravar na pasta escolhida.");
      return;
    }
    if (result.failed) {
      setBusy(null);
      setMessage(`${result.failed} arquivo(s) falharam. Confira o CORS do bucket ou baixe os originais.`);
      return;
    }
    let note = `${result.files} arquivo(s) e ${result.labels} etiqueta(s) na pasta ${order.number}.`;
    if (order.status === "paid") {
      if (await patchOrder(order.id, { status: "in_production" })) {
        note += " Pedido em produção.";
        router.refresh();
      } else {
        note += " Não foi possível marcar como em produção.";
      }
    }
    setBusy(null);
    setMessage(note);
  }

  async function deletePhotos() {
    setBusy("delete");
    setMessage(null);
    const res = await fetch(`/api/admin/pedidos/${order.id}/fotos`, { method: "DELETE" }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setBusy(null);
    setConfirmDelete(false);
    if (res?.ok) {
      setMessage(`${body?.deleted ?? 0} arquivo(s) apagados do servidor.`);
      router.refresh();
    } else {
      setMessage(body?.error ?? "Não foi possível apagar as imagens.");
    }
  }

  if (!photos.length) return <p className="text-ink-2">Este pedido não tem fotos.</p>;

  return (
    <div>
      {order.photos_deleted_at ? (
        <p className="alert alert-warning">
          Imagens apagadas do servidor em {formatDate(order.photos_deleted_at)}. Só o histórico ficou.
        </p>
      ) : blocked ? (
        <p className="alert alert-warning">{blocked}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={downloadFolder}
            disabled={busy !== null || !canPickFolder}
          >
            {busy === "all" ? (
              <CircleNotchIcon size={18} className="spinner" aria-hidden />
            ) : (
              <FoldersIcon size={18} aria-hidden />
            )}
            Baixar pedido em pastas ({files})
          </button>
        </div>
      )}
      <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold">
        {message}
      </p>
      {downloadable && !message && (
        <p className="text-sm text-ink-2">
          {canPickFolder
            ? `Pasta com o número do pedido, uma subpasta por tamanho, cópias contadas e o PDF das etiquetas na folha A4. Escolha uma pasta sua, como Área de Trabalho\\Pedidos.`
            : "Para baixar em pastas, abra o painel no Chrome ou no Edge do computador."}
        </p>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => {
          const product = productOf(photo);
          return (
            <li key={photo.id} className="card flex flex-col p-3">
              {product && <PrintPreview src={photo.thumb_url} alt={photo.file_name} photo={photo} product={product} />}
              <p className="mt-2 font-bold">
                {photo.quantity}× {product ? sizeName(product) : photo.product_id}
              </p>
              {product && (
                <p className="text-sm text-ink-2">
                  {product.id === "mini-polaroid" ? "Folha 10,2x15,2 cm, 2 por folha" : `Papel ${realSizeLabel(product)} cm`}
                </p>
              )}
              <p className="text-sm text-ink-2">
                {[photo.fit ? "foto inteira" : "", ...describeAdjust(photo.adjust)].filter(Boolean).join(", ")}
              </p>
              <p className="truncate text-sm text-ink-2" title={photo.file_name}>
                {photo.file_name}
              </p>
              {downloadable && photo.original_url && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(photo.id);
                      setMessage(null);
                      await downloadOne(photo).catch((err) => {
                        reportError("loja", err, { etapa: "baixar recortada", photo: photo.id, file: photo.base_name });
                        setMessage("Falha ao recortar. Confira o CORS do bucket ou baixe o original.");
                      });
                      setBusy(null);
                    }}
                  >
                    {busy === photo.id ? (
                      <CircleNotchIcon size={16} className="spinner" aria-hidden />
                    ) : (
                      <ScissorsIcon size={16} aria-hidden />
                    )}
                    Recortada
                  </button>
                  <a href={photo.original_url} className="btn btn-ghost btn-sm">
                    <DownloadSimpleIcon size={16} aria-hidden />
                    Original
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canDeletePhotos(order) && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
          {confirmDelete ? (
            <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar limpeza das imagens">
              <button
                type="button"
                className="btn bg-danger text-white hover:bg-danger/90"
                onClick={deletePhotos}
                disabled={busy !== null}
              >
                {busy === "delete" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
                Apagar {photos.length} imagem(ns) do servidor
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
              <TrashIcon size={18} aria-hidden />
              Apagar imagens do servidor
            </button>
          )}
          <p className="text-sm text-ink-2">
            Libera espaço. O pedido continua no painel, sem as fotos. Baixe antes, se ainda precisar.
          </p>
        </div>
      )}
    </div>
  );
}
