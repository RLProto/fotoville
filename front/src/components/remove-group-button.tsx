"use client";

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Remove do carrinho todas as fotos de um tamanho, com confirmação em dois toques. */
export function RemoveGroupButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    await fetch(`/api/photos?product=${encodeURIComponent(productId)}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirming(true)}>
        <TrashIcon size={16} aria-hidden />
        Remover
        <span className="sr-only"> fotos {productName}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={`Confirmar remoção das fotos ${productName}`}>
      <button type="button" className="btn btn-sm bg-danger text-white hover:bg-danger/90" onClick={remove} disabled={loading}>
        {loading && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
        Sim, remover
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={loading}>
        Cancelar
      </button>
    </span>
  );
}
