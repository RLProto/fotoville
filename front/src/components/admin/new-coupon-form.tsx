"use client";

import { CircleNotchIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUPON_CODE, COUPON_CODE_MAX, cleanCouponCode } from "@/lib/coupon-rules";
import { parseMoney } from "@/lib/format";

/** Hoje em Brasília, no formato do campo de data (AAAA-MM-DD). */
const todayBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Cria um cupom de desconto percentual. Fica recolhido atrás do botão "Novo cupom". */
export function NewCouponForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percent, setPercent] = useState("10");
  const [minOrder, setMinOrder] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [singleUse, setSingleUse] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [oncePerCustomer, setOncePerCustomer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(percent);
    const min = minOrder.trim() ? parseMoney(minOrder) : 0;
    const limit = maxUses.trim() ? Number(maxUses) : undefined;
    if (!COUPON_CODE.test(code)) return setError("O código precisa ter de 3 a 20 letras e números.");
    if (!Number.isInteger(p) || p < 1 || p > 100) return setError("Desconto de 1 a 100%, sem casas decimais.");
    if (min === null) return setError("Pedido mínimo inválido. Use o formato 50,00.");
    if (!singleUse && limit !== undefined && (!Number.isInteger(limit) || limit < 1)) return setError("Limite de usos inválido.");
    if (expiresOn && expiresOn < todayBrasilia()) return setError("A validade já passou. Escolha hoje ou uma data futura.");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          description: description.trim() || undefined,
          percent: p,
          min_order_cents: min,
          expires_on: expiresOn || undefined,
          max_uses: singleUse ? 1 : limit,
          once_per_customer: !singleUse && oncePerCustomer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o cupom. Tente de novo.");
      router.push(`/admin/cupons/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o cupom. Tente de novo.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <PlusIcon size={18} aria-hidden />
        Novo cupom
      </button>
    );
  }

  const suffix = "pointer-events-none absolute inset-y-0 flex items-center text-sm font-semibold text-ink-2";

  return (
    <form onSubmit={create} className="card max-w-3xl p-5 sm:p-6" noValidate>
      <h2 className="text-lg font-bold">Novo cupom</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label htmlFor="cupom-codigo" className="field-label">
            Código
          </label>
          <input
            id="cupom-codigo"
            className="field-input font-semibold tracking-wider uppercase"
            autoComplete="off"
            spellCheck={false}
            maxLength={COUPON_CODE_MAX}
            placeholder="NATAL10"
            value={code}
            onChange={(e) => setCode(cleanCouponCode(e.target.value))}
          />
          <p className="field-hint">3 a 20 letras e números.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cupom-desconto" className="field-label">
            Desconto
          </label>
          <div className="relative">
            <input
              id="cupom-desconto"
              inputMode="numeric"
              className="field-input pr-9 text-right tabular-nums"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
            <span className={`${suffix} right-3.5`} aria-hidden>
              %
            </span>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="cupom-descricao" className="field-label">
            Descrição <span className="font-normal text-ink-3">(opcional)</span>
          </label>
          <input
            id="cupom-descricao"
            className="field-input"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="cupom-minimo" className="field-label">
            Pedido mínimo
          </label>
          <div className="relative">
            <span className={`${suffix} left-3.5`} aria-hidden>
              R$
            </span>
            <input
              id="cupom-minimo"
              inputMode="decimal"
              className="field-input pl-10 text-right tabular-nums"
              placeholder="0,00"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
            />
          </div>
          <p className="field-hint">Vazio: sem mínimo.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cupom-validade" className="field-label">
            Válido até
          </label>
          <input
            id="cupom-validade"
            type="date"
            className="field-input"
            min={todayBrasilia()}
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          <p className="field-hint">Vazio: sem validade.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cupom-limite" className="field-label">
            Limite de usos
          </label>
          <input
            id="cupom-limite"
            inputMode="numeric"
            className="field-input text-right tabular-nums disabled:bg-paper disabled:text-ink-3"
            placeholder="Sem limite"
            disabled={singleUse}
            value={singleUse ? "1" : maxUses}
            onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 7))}
          />
        </div>

        <fieldset className="sm:col-span-6">
          <legend className="sr-only">Regras de uso</legend>
          <div className="flex flex-wrap gap-x-8">
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-4 accent-action" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} />
              Uso único
            </label>
            <label className={`flex min-h-11 items-center gap-2 ${singleUse ? "text-ink-3" : ""}`}>
              <input
                type="checkbox"
                className="size-4 accent-action"
                checked={!singleUse && oncePerCustomer}
                disabled={singleUse}
                onChange={(e) => setOncePerCustomer(e.target.checked)}
              />
              Uma vez por cliente
            </label>
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-rule pt-5">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          Criar cupom
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
