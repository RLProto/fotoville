"use client";

import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Candidate = { id: string; name: string; email: string };

const SHOWN = 30;

/** Remove acentos e maiúsculas para a busca achar "joão" digitando "joao". */
function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Lista as contas do site com busca por nome ou e-mail, para tornar alguém admin. */
export function UserSearch({ users }: { users: Candidate[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const indexed = useMemo(() => users.map((u) => ({ ...u, key: normalize(`${u.name} ${u.email}`) })), [users]);
  const q = normalize(query.trim());
  const matches = q ? indexed.filter((u) => u.key.includes(q)) : indexed;
  const shown = matches.slice(0, SHOWN);

  async function promote(u: Candidate) {
    setSaving(u.id);
    setError(null);
    const res = await fetch("/api/admin/equipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
    } else {
      const data = await res?.json().catch(() => ({}));
      setError({ id: u.id, message: data?.error ?? "Não foi possível adicionar. Tente de novo." });
    }
    setSaving(null);
  }

  return (
    <section className="card p-5" aria-labelledby="usuarios-titulo">
      <h2 id="usuarios-titulo" className="text-lg font-bold">
        Adicionar admin
      </h2>
      <div className="relative mt-4">
        <label htmlFor="busca-usuario" className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <MagnifyingGlassIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" aria-hidden />
        <input
          id="busca-usuario"
          type="search"
          autoComplete="off"
          placeholder="Buscar por nome ou e-mail"
          className="field-input pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="mt-3 text-sm text-ink-2" aria-live="polite">
        {matches.length === 1 ? "1 usuário" : `${matches.length} usuários`}
        {matches.length > SHOWN && `, mostrando ${SHOWN}. Refine a busca`}.
      </p>

      {shown.length === 0 ? (
        <p className="mt-4 text-ink-2">Nenhum usuário encontrado.</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule border-t border-rule">
          {shown.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <span className="min-w-0">
                <span className="block font-semibold">{u.name}</span>
                {u.email && u.email !== u.name && <span className="block text-sm break-all text-ink-2">{u.email}</span>}
              </span>
              <span className="inline-flex flex-col items-end">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => promote(u)} disabled={saving !== null}>
                  {saving === u.id && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
                  Tornar admin
                  <span className="sr-only"> {u.name}</span>
                </button>
                {error?.id === u.id && (
                  <span className="field-error" role="alert">
                    {error.message}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
