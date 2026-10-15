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

  return (
    <form onSubmit={create} className="card p-5" noValidate>
      <h2 className="text-lg font-bold">Novo cupom</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cupom-codigo" className="field-label">
            Código
          </label>
          <input
            id="cupom-codigo"
            className="field-input font-semibold tracking-wider uppercase"
            autoComplete="off"
            spellCheck={false}
            maxLength={COUPON_CODE_MAX}
            value={code}
            onChange={(e) => setCode(cleanCouponCode(e.target.value))}
            aria-describedby="cupom-codigo-dica"
          />
          <p id="cupom-codigo-dica" className="field-hint">
            Letras e números, de 3 a 20.
          </p>
        </div>
        <div>
          <label htmlFor="cupom-desconto" className="field-label">
            Desconto
          </label>
          <div className="flex items-center gap-2">
            <input
              id="cupom-desconto"
              inputMode="numeric"
              className="field-input w-24 text-right tabular-nums"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
            <span className="font-semibold">%</span>
          </div>
          <p className="field-hint">Sobre as fotos, sem o frete.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cupom-descricao" className="field-label">
            Descrição
          </label>
          <input
            id="cupom-descricao"
            className="field-input"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cupom-minimo" className="field-label">
            Pedido mínimo
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2">R$</span>
            <input
              id="cupom-minimo"
              inputMode="decimal"
              className="field-input w-32 text-right tabular-nums"
              placeholder="0,00"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
            />
          </div>
          <p className="field-hint">Em fotos. Vazio: sem mínimo.</p>
        </div>
        <div>
          <label htmlFor="cupom-validade" className="field-label">
            Válido até
          </label>
          <input
            id="cupom-validade"
            type="date"
            className="field-input w-44"
            min={todayBrasilia()}
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          <p className="field-hint">Vale até o fim do dia. Vazio: sem validade.</p>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="field-label">Usos</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-4 accent-action" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} />
            Uso único (vale para um pedido só)
          </label>
          {!singleUse && (
            <>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-action"
                  checked={oncePerCustomer}
                  onChange={(e) => setOncePerCustomer(e.target.checked)}
                />
                Uma vez por cliente
              </label>
              <div className="mt-2">
                <label htmlFor="cupom-limite" className="field-label">
                  Limite de usos
                </label>
                <input
                  id="cupom-limite"
                  inputMode="numeric"
                  className="field-input w-32 text-right tabular-nums"
                  placeholder="Sem limite"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 7))}
                />
              </div>
            </>
          )}
        </fieldset>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
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
