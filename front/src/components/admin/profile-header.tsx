"use client";

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { plural } from "@/lib/format";

/** Nome do perfil (renomear) e exclusão, com confirmação que diz o que acontece com os clientes. */
export function ProfileHeader({ id, name, customers }: { id: string; name: string; customers: number }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || value.trim() === name) return;
    setState("saving");
    const res = await fetch(`/api/admin/perfis/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/perfis/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/admin/perfis");
      router.refresh();
      return;
    }
    setError("Não foi possível excluir o perfil. Tente de novo.");
    setDeleting(false);
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <form onSubmit={rename} className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0">
          <label htmlFor="nome-perfil" className="field-label">
            Nome do perfil
          </label>
          <input
            id="nome-perfil"
            className="field-input w-72 max-w-full text-lg font-bold"
            maxLength={60}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setState("idle");
            }}
          />
        </div>
        <button type="submit" className="btn btn-outline" disabled={state === "saving" || !value.trim() || value.trim() === name}>
          {state === "saving" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          Renomear
        </button>
        <span className="pb-3 text-sm" role="status">
          {state === "saved" && <span className="text-success">Nome salvo.</span>}
          {state === "error" && <span className="text-danger">Não foi possível salvar. Tente de novo.</span>}
        </span>
      </form>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar exclusão">
          <p className="text-sm">
            {customers
              ? `${plural(customers, "cliente volta", "clientes voltam")} para a tabela da loja.`
              : "O perfil será excluído."}
          </p>
          <button type="button" className="btn bg-danger text-white hover:bg-danger/90" onClick={remove} disabled={deleting}>
            {deleting && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
            Excluir perfil
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>
          <TrashIcon size={18} aria-hidden />
          Excluir perfil
        </button>
      )}
      {error && (
        <p className="basis-full field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
