"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Remove o acesso ao painel, com confirmação no próprio botão. */
export function RemoveAdminButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/equipe/${userId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(data?.error ?? "Não foi possível remover. Tente de novo.");
    setSaving(false);
    setConfirming(false);
  }

  return (
    <span className="inline-flex flex-col items-end">
      {confirming ? (
        <span className="inline-flex gap-2">
          <button type="button" className="btn btn-outline btn-sm text-danger" onClick={remove} disabled={saving}>
            {saving && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
            Confirmar
            <span className="sr-only"> a remoção de {name}</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={saving}>
            Cancelar
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
          Remover
          <span className="sr-only"> {name}</span>
        </button>
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
