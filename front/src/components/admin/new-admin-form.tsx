"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Adiciona um admin pelo e-mail da conta. */
export function NewAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível adicionar. Tente de novo.");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível adicionar. Tente de novo.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={add} className="card p-5" noValidate>
      <h2 className="text-lg font-bold">Adicionar admin</h2>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="admin-email" className="field-label">
            E-mail da conta
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="off"
            className="field-input"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-email-erro" : undefined}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          Adicionar
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-2">A pessoa precisa ter conta no site.</p>
      {error && (
        <p id="admin-email-erro" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
