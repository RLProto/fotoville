"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOTE_MAX, noteLength, noteProblem, normalizeNote } from "@/lib/order-note";

/**
 * Descrição do pedido na página do cliente. Sem descrição, o campo fica aberto; com ela, aparece
 * como texto e abre em "Editar". Depois que a etiqueta sai, só o texto.
 */
export function OrderNote({ orderId, initial, editable }: { orderId: string; initial: string | null; editable: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(!initial);
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const problem = noteProblem(normalizeNote(value));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problem) return setError(problem);
    setState("saving");
    setError(null);
    const res = await fetch(`/api/pedidos/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: value }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { note?: string | null; error?: string } | null;
    if (!res?.ok) {
      setState("idle");
      setError(body?.error ?? "Não foi possível salvar. Tente de novo.");
      return;
    }
    const note = body?.note ?? null;
    setSaved(note);
    setValue(note ?? "");
    setEditing(!note);
    setState("saved");
    router.refresh();
  }

  if (!editable) {
    if (!saved) return null;
    return (
      <p className="mt-6">
        <span className="text-ink-2">Descrição: </span>
        <strong>{saved}</strong>
      </p>
    );
  }

  if (!editing) {
    return (
      <div className="mt-6 flex flex-wrap items-baseline gap-x-4">
        <p>
          <span className="text-ink-2">Descrição: </span>
          <strong>{saved}</strong>
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-semibold text-action underline underline-offset-2"
          onClick={() => {
            setState("idle");
            setEditing(true);
          }}
        >
          Editar
        </button>
        <p aria-live="polite" className="text-sm font-semibold text-success">
          {state === "saved" && "Descrição salva."}
        </p>
      </div>
    );
  }

  const length = noteLength(value.trim());
  return (
    <form onSubmit={submit} className="mt-6 max-w-xl" noValidate>
      <label htmlFor="descricao" className="field-label">
        Descrição do pedido
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="descricao"
          name="descricao"
          autoComplete="off"
          className="field-input min-w-0 flex-1 basis-56"
          maxLength={NOTE_MAX}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby="descricao-ajuda"
          onChange={(e) => {
            setValue(Array.from(e.target.value).slice(0, NOTE_MAX).join(""));
            setError(null);
            setState("idle");
          }}
        />
        <div className="flex gap-3">
          <button type="submit" className="btn btn-primary" disabled={state === "saving"}>
            {state === "saving" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
            Salvar
          </button>
          {saved && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setValue(saved);
                setError(null);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
      <p id="descricao-ajuda" aria-live="polite" className={error ? "field-error" : "field-hint"}>
        {error ?? (
          <span className="tabular-nums">
            {length}/{NOTE_MAX}
          </span>
        )}
      </p>
    </form>
  );
}
