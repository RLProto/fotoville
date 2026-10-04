"use client";

import { useState } from "react";

/** Perfil de preço de um cliente, gravado na hora em que muda. */
export function CustomerProfileSelect({
  userId,
  customerName,
  value,
  profiles,
}: {
  userId: string;
  customerName: string;
  value: string | null;
  profiles: { id: string; name: string }[];
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function change(next: string) {
    const before = current;
    setCurrent(next);
    setState("saving");
    const res = await fetch(`/api/admin/clientes/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: next || null }),
    }).catch(() => null);
    if (res?.ok) setState("saved");
    else {
      setCurrent(before);
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Perfil de ${customerName}`}
        className="field-input w-auto min-w-40"
        value={current}
        disabled={state === "saving"}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">Tabela da loja</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-sm" role="status">
        {state === "saving" && <span className="text-ink-2">Salvando…</span>}
        {state === "saved" && <span className="text-success">Salvo</span>}
        {state === "error" && <span className="text-danger">Não salvou. Tente de novo.</span>}
      </span>
    </div>
  );
}
