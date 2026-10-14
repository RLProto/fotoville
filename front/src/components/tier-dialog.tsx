"use client";

import { TagIcon, XIcon } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { TierTable } from "@/components/tier-table";
import type { Product } from "@/lib/types";

/** Link "Desconto progressivo" que abre a tabela de faixas do tamanho numa janela. */
export function TierDialog({ product }: { product: Product }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  if (!product.price_tiers.length) return null;

  return (
    <>
      <button type="button" className="link mt-1 inline-flex min-h-11 items-center gap-1.5" onClick={() => dialogRef.current?.showModal()}>
        <TagIcon size={18} aria-hidden />
        Desconto progressivo
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(100vw-1.5rem,24rem)] max-w-none rounded-panel bg-surface p-0 shadow-lift backdrop:bg-ink/70"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3">
          <h2 id={titleId} className="text-lg font-bold">
            Desconto progressivo
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-action-soft"
          >
            <XIcon size={22} aria-hidden />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-4 text-ink-2">Quanto mais fotos {product.name.replace(" cm", "")} no pedido, menor o preço de cada uma.</p>
          <TierTable products={[product]} />
        </div>
      </dialog>
    </>
  );
}
