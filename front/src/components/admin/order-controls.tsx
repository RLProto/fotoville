"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOTE_MAX, normalizeNote, noteProblem } from "@/lib/order-note";
import { canPickStatus } from "@/lib/order-rules";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";

export function OrderControls({
  orderId,
  status,
  trackingCode,
  note,
}: {
  orderId: string;
  status: OrderStatus;
  trackingCode: string | null;
  note: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [description, setDescription] = useState(note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Só manda a descrição se mudou: o cliente pode ter mudado enquanto a página estava aberta
    const changed = normalizeNote(description) !== note;
    const problem = changed ? noteProblem(normalizeNote(description)) : null;
    if (problem) {
      setError(problem);
      setState("error");
      return;
    }
    setState("saving");
    setError(null);
    const res = await fetch(`/api/admin/pedidos/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus === status ? undefined : nextStatus,
        tracking_code: tracking,
        note: changed ? description : undefined,
      }),
    }).catch(() => null);
    if (!res?.ok) setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 sm:items-end">
      <div>
        <label htmlFor="status" className="field-label">
          Status
        </label>
        <select
          id="status"
          className="field-input"
          value={nextStatus}
          onChange={(e) => {
            setNextStatus(e.target.value as OrderStatus);
            setState("idle");
          }}
        >
          {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[])
            .filter((s) => canPickStatus(status, s))
            .map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor="rastreio" className="field-label">
          Código de rastreio
        </label>
        <input
          id="rastreio"
          name="rastreio"
          spellCheck={false}
          autoComplete="off"
          className="field-input uppercase"
          placeholder="AA123456789BR"
          value={tracking}
          onChange={(e) => {
            setTracking(e.target.value);
            setState("idle");
          }}
        />
      </div>
      <div>
        <label htmlFor="descricao" className="field-label">
          Descrição na etiqueta
        </label>
        <input
          id="descricao"
          name="descricao"
          autoComplete="off"
          className="field-input"
          maxLength={NOTE_MAX + 10}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setState("idle");
          }}
        />
      </div>
      <button type="submit" className="btn btn-primary justify-self-start" disabled={state === "saving"}>
        {state === "saving" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
        Salvar
      </button>
      <p aria-live="polite" className="text-sm font-semibold sm:col-span-2">
        {state === "saved" && <span className="text-success">Pedido atualizado.</span>}
        {state === "error" && <span className="text-danger">{error ?? "Não foi possível salvar."}</span>}
      </p>
    </form>
  );
}
