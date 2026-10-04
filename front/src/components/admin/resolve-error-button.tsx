"use client";

import { CheckIcon, CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Marca todas as ocorrências abertas de um erro como resolvidas. */
export function ResolveErrorButton({ scope, message }: { scope: string; message: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resolve() {
    setBusy(true);
    setFailed(false);
    const res = await fetch("/api/admin/erros", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, message }),
    }).catch(() => null);
    if (res?.ok) router.refresh();
    else setFailed(true);
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn btn-outline btn-sm" onClick={resolve} disabled={busy}>
        {busy ? <CircleNotchIcon size={16} className="spinner" aria-hidden /> : <CheckIcon size={16} aria-hidden />}
        Marcar como resolvido
      </button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-danger">
          Não foi possível. Tente de novo.
        </p>
      )}
    </div>
  );
}
