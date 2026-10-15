"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Habilita ou desabilita um cupom. */
export function CouponActiveToggle({ code, active }: { code: string; active: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setSaving(true);
    setError(false);
    const res = await fetch(`/api/admin/cupons/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    }).catch(() => null);
    if (res?.ok) router.refresh();
    else setError(true);
    setSaving(false);
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" className="btn btn-outline btn-sm" onClick={toggle} disabled={saving}>
        {saving && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
        {active ? "Desativar" : "Ativar"}
        <span className="sr-only"> o cupom {code}</span>
      </button>
      {error && (
        <span className="field-error" role="alert">
          Não foi possível alterar. Tente de novo.
        </span>
      )}
    </span>
  );
}
