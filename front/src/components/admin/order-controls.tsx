"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";

export function OrderControls({
  orderId,
  status,
  trackingCode,
}: {
  orderId: string;
  status: OrderStatus;
  trackingCode: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    const res = await fetch(`/api/admin/pedidos/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus === status ? undefined : nextStatus, tracking_code: tracking }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="status" className="field-label">
          Situação
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
          {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
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
      <button type="submit" className="btn btn-primary" disabled={state === "saving"}>
        {state === "saving" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
        Salvar
      </button>
      <p aria-live="polite" className="text-sm font-semibold sm:col-span-3">
        {state === "saved" && <span className="text-success">Pedido atualizado.</span>}
        {state === "error" && <span className="text-danger">Não foi possível salvar.</span>}
      </p>
    </form>
  );
}
