"use client";

import { ImageBrokenIcon } from "@phosphor-icons/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { isLandscape, paperLayout } from "@/lib/crop";
import { loadImage, type DecodedImage } from "@/lib/decode-image";
import { renderPrint } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";
import type { Photo, Product } from "@/lib/types";

/** Distância da tela em que a miniatura já é carregada (e até onde ela fica na memória). */
const NEAR = "800px 0px";

type Loaded = { src: string; image: Promise<DecodedImage>; controller: AbortController };

/** O cartão está perto da área visível? Sem IntersectionObserver, considera sempre que sim. */
function useNearViewport(ref: RefObject<Element | null>) {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: NEAR });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return near;
}

/**
 * Solta a foto decodificada e, com `canvas`, esvazia o desenho: com centenas de fotos, o celular não aguenta
 * todas na memória.
 */
function release(loaded: RefObject<Loaded | null>, canvas?: RefObject<HTMLCanvasElement | null>) {
  const current = loaded.current;
  loaded.current = null;
  if (current) {
    current.controller.abort();
    current.image.then((img) => img.close()).catch(() => {});
  }
  if (canvas?.current) {
    canvas.current.width = 0;
    canvas.current.height = 0;
  }
}

/**
 * Miniatura da impressão como vai sair: papel, borda ou moldura, corte, cor e legenda.
 * Desenhada pelo mesmo código que gera o arquivo da loja. Só é desenhada perto da tela.
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
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaded = useRef<Loaded | null>(null);
  const near = useNearViewport(boxRef);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Longe da tela: libera a memória. Volta a desenhar quando o cartão se aproxima.
  useEffect(() => {
    if (!near) release(loaded, canvasRef);
  }, [near]);
  useEffect(() => {
    const canvas = canvasRef;
    return () => release(loaded, canvas);
  }, []);

  // A foto decodificada fica guardada enquanto o cartão está perto: arrastar para enquadrar redesenha sem baixar de novo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!src || !near || !canvas) return;
    let cancelled = false;
    if (loaded.current?.src !== src) {
      // Outra foto: o desenho antigo fica até o novo ficar pronto
      release(loaded);
      const controller = new AbortController();
      loaded.current = { src, image: loadImage(src, controller.signal), controller };
    }
    const layout = paperLayout(product, isLandscape(photo), photo.adjust);
    loaded.current.image
      .then(async (image) => {
        if (cancelled) return;
        const off = document.createElement("canvas");
        await renderPrint(off, image, photo, product, resolution / Math.max(layout.width, layout.height));
        if (cancelled) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d")!.drawImage(off, 0, 0);
      })
      .catch((err) => {
        if (cancelled) return;
        // Só o caminho do arquivo: a URL assinada inteira não interessa e expira.
        const file = src.startsWith("blob:") ? "local" : new URL(src).pathname;
        reportError("miniatura", err, { file }, "warning");
        setFailedSrc(src);
      });
    return () => {
      cancelled = true;
    };
  }, [src, near, photo, product, resolution]);

  const layout = paperLayout(product, isLandscape(photo), photo.adjust);
  const aspect = layout.width / layout.height;
  const size = aspect >= 1 ? { width: "100%" } : { height: "100%" };
  const failed = !src || failedSrc === src;

  // O canvas fica solto (absolute) dentro de uma caixa já dimensionada: assim o tamanho interno
  // dele (centenas de pixels) nunca empurra o cartão nem a página.
  return (
    <div ref={boxRef} className="flex aspect-square items-center justify-center rounded-panel bg-paper p-3">
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
