"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Cria um perfil de cliente: nome e desconto inicial sobre a tabela da loja. */
export function NewProfileForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [percent, setPercent] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(percent.replace(",", ".") || "0");
    if (!name.trim()) return setError("Dê um nome ao perfil.");
    if (!Number.isFinite(p) || p < 0 || p > 90) return setError("Desconto entre 0 e 90%.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), percent: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o perfil. Tente de novo.");
      router.push(`/admin/perfis/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o perfil. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={create} className="card p-5" noValidate>
      <h2 className="text-lg font-bold">Novo perfil</h2>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="perfil-nome" className="field-label">
            Nome
          </label>
          <input id="perfil-nome" className="field-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="perfil-desconto" className="field-label">
            Desconto inicial
          </label>
          <div className="flex items-center gap-2">
            <input
              id="perfil-desconto"
              inputMode="decimal"
              className="field-input w-24 text-right tabular-nums"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <span className="font-semibold">%</span>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          Criar perfil
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        O perfil nasce com esse desconto sobre a tabela da loja. Depois dá para ajustar cada preço. Tamanho igual à loja acompanha a tabela da loja quando ela mudar.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
