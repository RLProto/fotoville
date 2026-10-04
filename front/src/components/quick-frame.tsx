"use client";

import { useMemo, useRef, useState } from "react";
import { isLandscape, paperLayout } from "@/lib/crop";
import type { Crop, Photo, Product } from "@/lib/types";
import { PrintPreview } from "./print-preview";

type Shape = Pick<Photo, "width_px" | "height_px" | "crop" | "fit" | "adjust">;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Prévia da foto que se enquadra arrastando, sem abrir o editor.
 * Mouse e caneta arrastam sempre. No toque, só com o modo "Enquadrar" ligado (`framing`), para o dedo
 * continuar rolando a página. Clique ou toque sem arrastar abre o editor completo.
 */
export function QuickFrame({
  src,
  label,
  photo,
  product,
  framing,
  onCommit,
  onOpen,
}: {
  src: string | null;
  label: string;
  photo: Shape;
  product: Pick<Product, "width_cm" | "height_cm" | "kind"> & { id?: string };
  framing: boolean;
  onCommit: (crop: Crop) => void;
  onOpen: () => void;
}) {
  const wrap = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Crop; ratio: number; last: Crop | null } | null>(null);
  const dragged = useRef(false);
  const [draft, setDraft] = useState<Crop | null>(null);
  const movable = !photo.fit && Boolean(photo.crop);
  const shown = useMemo(() => (draft ? { ...photo, crop: draft } : photo), [photo, draft]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || !movable || !photo.crop) return;
    if (e.pointerType === "touch" && !framing) return;
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    // Pixels da foto original por pixel da tela, dentro da janela onde a foto aparece
    const layout = paperLayout(product, isLandscape(photo), photo.adjust);
    const pxPerMm = canvas.getBoundingClientRect().width / layout.width;
    const ratio = photo.crop.width / (layout.window.w * pxPerMm);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: photo.crop, ratio, last: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.last && Math.hypot(dx, dy) < 4) return; // tremida de clique não conta como arraste
    const next = {
      ...d.start,
      x: Math.round(clamp(d.start.x - dx * d.ratio, 0, photo.width_px - d.start.width)),
      y: Math.round(clamp(d.start.y - dy * d.ratio, 0, photo.height_px - d.start.height)),
    };
    d.last = next;
    setDraft(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.last) return;
    dragged.current = true; // o clique que vem depois do arraste não abre o editor
    if (d.last.x !== d.start.x || d.last.y !== d.start.y) onCommit(d.last);
    setDraft(null);
  }

  return (
    <button
      ref={wrap}
      type="button"
      aria-label={label}
      className={`block w-full rounded-panel select-none ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
        framing && movable ? "outline-2 outline-offset-2 outline-action outline-dashed" : ""
      }`}
      style={{ touchAction: framing && movable ? "none" : "manipulation" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDraft(null);
      }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onOpen();
      }}
    >
      <PrintPreview src={src} alt="" photo={shown} product={product} />
    </button>
  );
}
