"use client";

import { CircleNotchIcon, DownloadSimpleIcon, FoldersIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PrintPreview } from "@/components/print-preview";
import { describeAdjust } from "@/lib/adjust";
import { realSizeLabel } from "@/lib/catalog-data";
import { renderPrintFile } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";
import type { OrderStatus, Photo, Product } from "@/lib/types";

export type AdminPhoto = Photo & {
  thumb_url: string | null;
  original_url: string;
  /** Nome base do arquivo: pedido_tamanho_índice */
  base_name: string;
};

/** API de acesso a pastas (Chrome e Edge no computador). Fora do lib.dom do TypeScript. */
type DirectoryHandle = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<DirectoryHandle>;
};

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Pasta de cada tamanho: a medida real do papel; nos especiais, com o nome para não confundir. */
function sizeFolder(product: Product) {
  const size = realSizeLabel(product);
  return product.kind === "print" ? size : `${size} ${product.name}`;
}

export function PhotoDownloads({
  orderId,
  orderNumber,
  status,
  photos,
  products,
}: {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  photos: AdminPhoto[];
  products: Product[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const productOf = (p: AdminPhoto) => products.find((x) => x.id === p.product_id);
  // No servidor não há window: assume que dá, e o navegador corrige logo depois de montar.
  const canPickFolder = useSyncExternalStore(
    () => () => {},
    () => !!(window as PickerWindow).showDirectoryPicker,
    () => true,
  );
  const copies = photos.reduce((sum, p) => sum + p.quantity, 0);

  async function renderOne(photo: AdminPhoto) {
    const product = productOf(photo);
    if (!product) throw new Error(`Tamanho ${photo.product_id} não encontrado.`);
    // Arquivo pronto para impressão: corte, borda ou moldura, cor e legenda, como o cliente viu.
    return { product, blob: await renderPrintFile(photo.original_url, photo, product) };
  }

  async function downloadOne(photo: AdminPhoto) {
    const { blob } = await renderOne(photo);
    save(blob, `${photo.base_name}.jpg`);
  }

  /**
   * Grava o pedido inteiro numa pasta do computador: <nº do pedido>/<medida real>/<arquivo>.jpg,
   * uma cópia por arquivo. Ao terminar sem falhas, pedido pago passa a "Em produção".
   */
  async function downloadFolder() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) return;
    let root: DirectoryHandle;
    try {
      root = await picker({ id: "fotoville-pedidos", mode: "readwrite", startIn: "desktop" });
    } catch {
      return; // janela fechada sem escolher
    }

    setBusy("all");
    setMessage(null);
    let failed = 0;
    let done = 0;
    try {
      const orderDir = await root.getDirectoryHandle(String(orderNumber), { create: true });
      for (const photo of photos) {
        try {
          const { product, blob } = await renderOne(photo);
          const dir = await orderDir.getDirectoryHandle(sizeFolder(product), { create: true });
          for (let copy = 1; copy <= photo.quantity; copy++) {
            const file = await dir.getFileHandle(`${photo.base_name}_${copy}.jpg`, { create: true });
            const stream = await file.createWritable();
            await stream.write(blob);
            await stream.close();
            done += 1;
            setMessage(`${done} de ${copies} arquivos gravados…`);
          }
        } catch (err) {
          reportError("loja", err, { etapa: "baixar pedido em pastas", photo: photo.id, file: photo.base_name });
          failed += 1;
        }
      }
    } catch (err) {
      reportError("loja", err, { etapa: "baixar pedido em pastas", order: orderId });
      setBusy(null);
      setMessage("Não foi possível gravar na pasta escolhida.");
      return;
    }

    if (failed) {
      setBusy(null);
      setMessage(`${failed} foto(s) falharam. Confira o CORS do bucket ou baixe os originais.`);
      return;
    }

    let note = `${done} arquivo(s) gravados na pasta ${orderNumber}.`;
    if (status === "paid") {
      const res = await fetch(`/api/admin/pedidos/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_production" }),
      }).catch(() => null);
      if (res?.ok) {
        note += " Pedido em produção.";
        router.refresh();
      } else {
        note += " Não foi possível marcar como em produção.";
      }
    }
    setBusy(null);
    setMessage(note);
  }

  if (!photos.length) return <p className="text-ink-2">Este pedido não tem fotos.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={downloadFolder} disabled={busy !== null || !canPickFolder}>
          {busy === "all" ? (
            <CircleNotchIcon size={18} className="spinner" aria-hidden />
          ) : (
            <FoldersIcon size={18} aria-hidden />
          )}
          Baixar pedido em pastas ({copies})
        </button>
        <p aria-live="polite" className="text-sm font-semibold">
          {message ?? (canPickFolder ? null : "Para baixar em pastas, abra o painel no Chrome ou no Edge do computador.")}
        </p>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => {
          const product = productOf(photo);
          return (
            <li key={photo.id} className="card flex flex-col p-3">
              {product && <PrintPreview src={photo.thumb_url} alt={photo.file_name} photo={photo} product={product} />}
              <p className="mt-2 font-bold">
                {photo.quantity}× {product?.name ?? photo.product_id}
              </p>
              {product && <p className="text-sm text-ink-2">Papel {realSizeLabel(product)} cm</p>}
              <p className="text-sm text-ink-2">
                {[photo.fit ? "foto inteira" : "", ...describeAdjust(photo.adjust)]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="truncate text-sm text-ink-2" title={photo.file_name}>
                {photo.file_name}
              </p>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
