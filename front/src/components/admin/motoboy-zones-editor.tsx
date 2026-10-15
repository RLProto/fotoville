"use client";

import { CircleNotchIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatBRL } from "@/lib/format";

export type ZoneRow = { id?: string; district: string; price_cents: number; active: boolean };
type Draft = { key: number; id?: string; district: string; price: string; active: boolean };

let nextKey = 1;
const toInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
/** Aceita "19,90", "19.9", "R$ 20" ou "20". Devolve centavos ou null. */
function parseMoney(text: string) {
  const clean = text.replace(/R\$|\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Bairros atendidos pelo motoboy, com preço e ativo/inativo. Salva a lista inteira de uma vez. */
export function MotoboyZonesEditor({ initial, defaultCents }: { initial: ZoneRow[]; defaultCents: number }) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() =>
    initial.map((z) => ({ key: nextKey++, id: z.id, district: z.district, price: toInput(z.price_cents), active: z.active })),
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");

  const update = (key: number, patch: Partial<Draft>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setState("idle");
  };

  function add() {
    setRows((list) => [...list, { key: nextKey++, district: "", price: toInput(defaultCents), active: true }]);
    setState("idle");
  }

  function applyBulk() {
    const cents = parseMoney(bulk);
    if (cents === null) {
      setError("Preço inválido. Use o formato 19,90.");
      return;
    }
    setRows((list) => list.map((r) => ({ ...r, price: toInput(cents) })));
    setError(null);
    setState("idle");
  }

  async function save() {
    const zones: ZoneRow[] = [];
    for (const r of rows) {
      const district = r.district.trim();
      const cents = parseMoney(r.price);
      if (district.length < 2) {
        setError("Há um bairro sem nome.");
        return;
      }
      if (cents === null) {
        setError(`Preço inválido em ${district}. Use o formato 19,90.`);
        return;
      }
      zones.push({ id: r.id, district, price_cents: cents, active: r.active });
    }
    setError(null);
    setState("saving");
    const res = await fetch("/api/admin/motoboy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zones }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.ok) {
      setState("saved");
      router.refresh();
    } else {
      setState("error");
      setError(body?.error ?? "Não foi possível salvar. Tente de novo.");
    }
  }

  const active = rows.filter((r) => r.active).length;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="preco-todos" className="field-label">
            Mesmo preço em todos
          </label>
          <div className="flex gap-2">
            <input
              id="preco-todos"
              inputMode="decimal"
              placeholder={toInput(defaultCents)}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              className="field-input w-28 tabular-nums"
            />
            <button type="button" className="btn btn-outline" onClick={applyBulk} disabled={!bulk.trim()}>
              Aplicar
            </button>
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={add}>
          <PlusIcon size={18} aria-hidden />
          Incluir bairro
        </button>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left">
          <caption className="sr-only">Bairros atendidos pelo motoboy</caption>
          <thead className="border-b border-rule text-sm text-ink-2">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">
                Bairro
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Preço
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Ativo
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Remover</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-b border-rule last:border-0 ${r.active ? "" : "text-ink-2"}`}>
                <td className="px-4 py-2">
                  <input
                    aria-label="Nome do bairro"
                    value={r.district}
                    onChange={(e) => update(r.key, { district: e.target.value })}
                    className="field-input h-10 min-h-10 py-0"
                    autoComplete="off"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-ink-2">R$</span>
                    <input
                      aria-label={`Preço em ${r.district || "novo bairro"}`}
                      inputMode="decimal"
                      value={r.price}
                      onChange={(e) => update(r.key, { price: e.target.value })}
                      className="field-input h-10 min-h-10 w-24 py-0 tabular-nums"
                    />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Motoboy ativo em ${r.district || "novo bairro"}`}
                    checked={r.active}
                    onChange={(e) => update(r.key, { active: e.target.checked })}
                    className="size-4 accent-action"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    aria-label={`Remover ${r.district || "bairro"}`}
                    onClick={() => {
                      setRows((list) => list.filter((x) => x.key !== r.key));
                      setState("idle");
                    }}
                  >
                    <TrashIcon size={16} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-2">
                  Nenhum bairro. Sem bairros, a opção de motoboy não aparece para o cliente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          Salvar
        </button>
        <p aria-live="polite" className="text-sm font-semibold">
          {state === "saved" && <span className="text-success">Bairros salvos.</span>}
          {error && <span className="text-danger">{error}</span>}
          {!error && state !== "saved" && (
            <span className="text-ink-2">
              {active} {active === 1 ? "bairro ativo" : "bairros ativos"}, a partir de{" "}
              {formatBRL(Math.min(defaultCents, ...rows.map((r) => parseMoney(r.price) ?? defaultCents)))}.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
