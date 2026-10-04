"use client";

import { CircleNotchIcon, DownloadSimpleIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { PrintPreview } from "@/components/print-preview";
import { describeAdjust } from "@/lib/adjust";
import { renderPrintFile } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";
import { FINISH_LABEL, type Photo, type Product } from "@/lib/types";

export type AdminPhoto = Photo & {
  thumb_url: string | null;
  original_url: string;
  /** Nome sugerido: pedido_tamanho_acabamento_cópias_índice */
  base_name: string;
};

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function PhotoDownloads({ photos, products }: { photos: AdminPhoto[]; products: Product[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const productOf = (p: AdminPhoto) => products.find((x) => x.id === p.product_id);

  async function downloadOne(photo: AdminPhoto) {
    const product = productOf(photo);
    if (!product) return;
    // Arquivo pronto para impressão: corte, borda ou moldura, cor e legenda, como o cliente viu.
    save(await renderPrintFile(photo.original_url, photo, product), `${photo.base_name}.jpg`);
  }

  async function downloadAll() {
    setBusy("all");
    setMessage(null);
    let failed = 0;
    for (const photo of photos) {
      try {
        await downloadOne(photo);
        await new Promise((r) => setTimeout(r, 350)); // o navegador bloqueia downloads em rajada
      } catch (err) {
        reportError("loja", err, { etapa: "baixar todas recortadas", photo: photo.id, file: photo.base_name });
        failed += 1;
      }
    }
    setBusy(null);
    setMessage(
      failed
        ? `${failed} foto(s) falharam. Confira o CORS do bucket ou baixe os originais.`
        : `${photos.length} arquivo(s) prontos para impressão baixados.`,
    );
  }

  if (!photos.length) return <p className="text-ink-2">Este pedido não tem fotos.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={downloadAll} disabled={busy !== null}>
          {busy === "all" ? <CircleNotchIcon size={18} className="spinner" aria-hidden /> : <ScissorsIcon size={18} aria-hidden />}
          Baixar todas recortadas ({photos.length})
        </button>
        <p aria-live="polite" className="text-sm font-semibold">
          {message}
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
              <p className="text-sm text-ink-2">
                {[FINISH_LABEL[photo.finish], photo.fit ? "foto inteira" : "", ...describeAdjust(photo.adjust)]
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
