"use client";

import { ImageBrokenIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { isLandscape, paperLayout } from "@/lib/crop";
import { loadImage, type DecodedImage } from "@/lib/decode-image";
import { renderPrint } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";
import type { Photo, Product } from "@/lib/types";

/**
 * Miniatura da impressão como vai sair: papel, borda ou moldura, corte, cor e legenda.
 * Desenhada pelo mesmo código que gera o arquivo da loja.
 */
export function PrintPreview({
  src,
  alt,
  photo,
  product,
  resolution = 480,
}: {
  src: string | null;
  alt: string;
  photo: Pick<Photo, "width_px" | "height_px" | "crop" | "fit" | "adjust">;
  product: Pick<Product, "width_cm" | "height_cm" | "kind">;
  /** Lado maior do desenho, em pixels. */
  resolution?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ src: string; image: DecodedImage } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    const controller = new AbortController();
    let image: DecodedImage | null = null;
    loadImage(src, controller.signal)
      .then((decoded) => {
        image = decoded;
        setLoaded({ src, image: decoded });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Só o caminho do arquivo: a URL assinada inteira não interessa e expira.
        const file = src.startsWith("blob:") ? "local" : new URL(src).pathname;
        reportError("miniatura", err, { file }, "warning");
        setFailedSrc(src);
      });
    return () => {
      controller.abort();
      image?.close();
    };
  }, [src]);

  const ready = loaded && loaded.src === src ? loaded.image : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !canvas) return;
    let cancelled = false;
    const layout = paperLayout(product, isLandscape(photo), photo.adjust);
    const off = document.createElement("canvas");
    renderPrint(off, ready, photo, product, resolution / Math.max(layout.width, layout.height))
      .then(() => {
        if (cancelled) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d")!.drawImage(off, 0, 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, photo, product, resolution]);

  const layout = paperLayout(product, isLandscape(photo), photo.adjust);
  const aspect = layout.width / layout.height;
  const size = aspect >= 1 ? { width: "100%" } : { height: "100%" };
  const failed = !src || failedSrc === src;

  // O canvas fica solto (absolute) dentro de uma caixa já dimensionada: assim o tamanho interno
  // dele (centenas de pixels) nunca empurra o cartão nem a página.
  return (
    <div className="flex aspect-square items-center justify-center rounded-panel bg-paper p-3">
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-[2px] bg-surface text-ink-2 ring-1 ring-rule"
        style={{ aspectRatio: aspect, ...size }}
      >
        {failed ? (
          <>
            <ImageBrokenIcon size={24} aria-hidden />
            <span className="sr-only">Miniatura indisponível</span>
          </>
        ) : (
          <canvas ref={canvasRef} role="img" aria-label={alt} className="absolute inset-0 size-full" />
        )}
      </div>
    </div>
  );
}
