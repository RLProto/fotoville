"use client";

import { CircleNotchIcon, DownloadSimpleIcon, FoldersIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PrintPreview } from "@/components/print-preview";
import { describeAdjust } from "@/lib/adjust";
import { realSizeLabel } from "@/lib/catalog-data";
import { loadImage, type DecodedImage } from "@/lib/decode-image";
import { MINI_SHEET, renderMiniSheetFile, renderPrintFileFromUrl } from "@/lib/photo-render";
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

const MINI = "mini-polaroid";
const MINI_SHEET_FOLDER = `${realSizeLabel({ width_cm: 10.2, height_cm: 15.2 })} Mini Polaroid`;

/** Um arquivo a gravar na pasta do pedido. `copies` grava o mesmo arquivo mais de uma vez. */
type Job = { folder: string; name: string; copies: number; photoIds: string[]; make: () => Promise<Blob> };

/**
 * Arquivos do pedido: um por foto (gravado tantas vezes quantas cópias), menos a Mini Polaroid,
 * que sai em folhas 10x15 com duas Minis cada, já contando as cópias.
 */
function planJobs(photos: AdminPhoto[], productOf: (p: AdminPhoto) => Product | undefined, orderNumber: number) {
  const jobs: Job[] = [];
  const minis: AdminPhoto[] = [];
  const cache = new Map<string, Promise<DecodedImage>>();
  const cached = (url: string) => cache.get(url) ?? cache.set(url, loadImage(url)).get(url)!;

  for (const photo of photos) {
    const product = productOf(photo);
    if (!product) throw new Error(`Tamanho ${photo.product_id} não encontrado.`);
    if (product.id === MINI) {
      for (let i = 0; i < photo.quantity; i++) minis.push(photo);
      continue;
    }
    jobs.push({
      folder: sizeFolder(product),
      name: photo.base_name,
      copies: photo.quantity,
      photoIds: [photo.id],
      // Arquivo pronto para impressão: corte, borda ou moldura, cor e legenda, como o cliente viu.
      make: () => renderPrintFileFromUrl(photo.original_url, photo, product),
    });
  }

  for (let i = 0; i < minis.length; i += MINI_SHEET.perSheet) {
    const group = minis.slice(i, i + MINI_SHEET.perSheet);
    jobs.push({
      folder: MINI_SHEET_FOLDER,
      name: `${orderNumber}_${MINI}_folha_${String(i / MINI_SHEET.perSheet + 1).padStart(3, "0")}`,
      copies: 1,
      photoIds: group.map((p) => p.id),
      make: async () => {
        const items = await Promise.all(
          group.map(async (photo) => ({ source: await cached(photo.original_url), photo, product: productOf(photo)! })),
        );
        return renderMiniSheetFile(items);
      },
    });
  }
  /** Libera as fotos decodificadas para as folhas. */
  const release = () => cache.forEach((p) => p.then((img) => img.close()).catch(() => {}));
  return { jobs, release };
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

  const files = planJobs(photos, productOf, orderNumber).jobs.reduce((sum, j) => sum + j.copies, 0);

  async function downloadOne(photo: AdminPhoto) {
    const product = productOf(photo);
    if (!product) return;
    save(await renderPrintFileFromUrl(photo.original_url, photo, product), `${photo.base_name}.jpg`);
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
    const { jobs, release } = planJobs(photos, productOf, orderNumber);
    try {
      const orderDir = await root.getDirectoryHandle(String(orderNumber), { create: true });
      for (const job of jobs) {
        try {
          const blob = await job.make();
          const dir = await orderDir.getDirectoryHandle(job.folder, { create: true });
          for (let copy = 1; copy <= job.copies; copy++) {
            const file = await dir.getFileHandle(`${job.name}_${copy}.jpg`, { create: true });
            const stream = await file.createWritable();
            await stream.write(blob);
            await stream.close();
            done += 1;
            setMessage(`${done} de ${files} arquivos gravados…`);
          }
        } catch (err) {
          reportError("loja", err, { etapa: "baixar pedido em pastas", photos: job.photoIds, file: job.name });
          failed += 1;
        }
      }
    } catch (err) {
      reportError("loja", err, { etapa: "baixar pedido em pastas", order: orderId });
      setBusy(null);
      setMessage("Não foi possível gravar na pasta escolhida.");
      return;
    } finally {
      release();
    }

    if (failed) {
      setBusy(null);
      setMessage(`${failed} arquivo(s) falharam. Confira o CORS do bucket ou baixe os originais.`);
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
          Baixar pedido em pastas ({files})
        </button>
        <p aria-live="polite" className="text-sm font-semibold">
          {message ?? (canPickFolder ? null : "Para baixar em pastas, abra o painel no Chrome ou no Edge do computador.")}
        </p>
      </div>
      {canPickFolder && !message && (
        <p className="mt-2 text-sm text-ink-2">
          Escolha uma pasta sua, como Área de Trabalho\Pedidos. O navegador não grava direto na Área de Trabalho, em
          Documentos nem em Downloads.
        </p>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => {
          const product = productOf(photo);
          return (
            <li key={photo.id} className="card flex flex-col p-3">
              {product && <PrintPreview src={photo.thumb_url} alt={photo.file_name} photo={photo} product={product} />}
              <p className="mt-2 font-bold">
                {photo.quantity}× {product?.name ?? photo.product_id}
              </p>
              {product && (
                <p className="text-sm text-ink-2">
                  {product.id === MINI ? "Folha 10,2x15,2 cm, 2 por folha" : `Papel ${realSizeLabel(product)} cm`}
                </p>
              )}
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
