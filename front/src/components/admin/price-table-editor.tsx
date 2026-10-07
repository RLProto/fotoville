"use client";

import { CircleNotchIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatBRL } from "@/lib/format";
import { alignTiers } from "@/lib/pricing";
import type { PriceRow, PriceTier } from "@/lib/types";

type Item = { id: string; name: string; min: number };
type Group = { title: string; items: Item[] };
type DraftTier = { key: number; min: string; price: string };
type Draft = { price: string; tiers: DraftTier[] };

let nextKey = 1;
const toInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
/** Aceita "1,99", "1.99", "R$ 2" ou "2". Devolve centavos ou null. */
function parseMoney(text: string) {
  const clean = text.replace(/R\$|\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
const toDraft = (row: PriceRow): Draft => ({
  price: toInput(row.price_cents),
  tiers: row.price_tiers.map((t) => ({ key: nextKey++, min: String(t.min), price: toInput(t.price_cents) })),
});

/** Converte o rascunho em linha da tabela, ou devolve o problema para mostrar no campo. */
function parseDraft(id: string, draft: Draft, allowEqual = false): { row: PriceRow } | { error: string } {
  const price = parseMoney(draft.price);
  if (price === null) return { error: "Preço inválido. Use o formato 1,99." };
  const tiers: PriceTier[] = [];
  for (const t of draft.tiers) {
    const min = Number(t.min);
    const cents = parseMoney(t.price);
    if (!Number.isInteger(min) || min < 2) return { error: "A quantidade da faixa começa em 2 fotos." };
    if (cents === null) return { error: `Preço inválido na faixa de ${min} fotos.` };
    tiers.push({ min, price_cents: cents });
  }
  tiers.sort((a, b) => a.min - b.min);
  for (let i = 0; i < tiers.length; i++) {
    if (i > 0 && tiers[i].min === tiers[i - 1].min) return { error: `Faixa repetida: ${tiers[i].min} fotos.` };
    const before = i === 0 ? price : tiers[i - 1].price_cents;
    if (tiers[i].price_cents > before) return { error: `A faixa de ${tiers[i].min} fotos não pode custar mais que a anterior.` };
    if (!allowEqual && tiers[i].price_cents === before) {
      return { error: `A faixa de ${tiers[i].min} fotos precisa ser mais barata que a anterior.` };
    }
  }
  return { row: { product_id: id, price_cents: price, price_tiers: tiers } };
}

const same = (a: PriceRow, b: PriceRow) =>
  a.price_cents === b.price_cents && JSON.stringify(a.price_tiers) === JSON.stringify(b.price_tiers);

/**
 * Tabela de preços editável: preço por foto e desconto progressivo de cada tamanho.
 * Serve para a tabela da loja e para a de um perfil de cliente (com a da loja como referência).
 * No perfil, tamanho igual à loja não tem linha própria: segue a tabela da loja, inclusive quando ela mudar.
 * As faixas do perfil usam as quantidades da loja (1, 20, 50...): só o preço de cada faixa muda.
 */
export function PriceTableEditor({
  groups,
  initial,
  reference,
  saveUrl,
  method,
}: {
  groups: Group[];
  /** Valores gravados da tabela que está sendo editada. */
  initial: Record<string, PriceRow>;
  /** Tabela da loja, no modo perfil: aparece como referência e serve de base para o desconto em lote. */
  reference?: Record<string, PriceRow>;
  saveUrl: string;
  method: "PUT" | "PATCH";
}) {
  const router = useRouter();
  const ids = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups]);
  // Tamanho sem linha no perfil (criado depois do perfil) parte da tabela da loja
  const baseOf = (id: string): PriceRow => {
    const row = initial[id] ?? reference?.[id] ?? { product_id: id, price_cents: 0, price_tiers: [] };
    return reference ? { ...row, price_tiers: alignTiers(row, reference[id]?.price_tiers ?? []) } : row;
  };

  const [saved, setSaved] = useState<Record<string, PriceRow>>(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(ids.map((id) => [id, toDraft(baseOf(id))])),
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const parsed = useMemo(
    () => Object.fromEntries(ids.map((id) => [id, parseDraft(id, drafts[id], !!reference)])),
    [ids, drafts, reference],
  );
  // Alterado = diferente do que está gravado (tamanho sem linha no perfil compara com a loja, que é o que vale)
  const savedOf = (id: string) => saved[id] ?? baseOf(id);
  const changed = ids.filter((id) => {
    const p = parsed[id];
    return "error" in p || !same(savedOf(id), p.row);
  });
  const invalid = ids.filter((id) => "error" in parsed[id]);

  const update = (id: string, fn: (d: Draft) => Draft) => setDrafts((all) => ({ ...all, [id]: fn(all[id]) }));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function applyPercent() {
    const p = Number(percent.replace(",", "."));
    if (!reference || !Number.isFinite(p) || p < 0 || p > 90) return setError("Desconto entre 0 e 90%.");
    setError(null);
    const f = (cents: number) => Math.round((cents * (100 - p)) / 100);
    setDrafts(
      Object.fromEntries(
        ids.map((id) => {
          const ref = reference[id];
          if (!ref) return [id, drafts[id]];
          return [id, toDraft({ product_id: id, price_cents: f(ref.price_cents), price_tiers: ref.price_tiers.map((t) => ({ min: t.min, price_cents: f(t.price_cents) })) })];
        }),
      ),
    );
    setToast(`Desconto de ${p}% aplicado sobre a tabela da loja. Confira e salve.`);
  }

  async function save() {
    if (invalid.length) return setError("Corrija os campos marcados antes de salvar.");
    setSaving(true);
    setError(null);
    const items = changed.map((id) => (parsed[id] as { row: PriceRow }).row);
    try {
      const res = await fetch(saveUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar. Tente de novo.");
      setSaved((s) => {
        const next = { ...s };
        for (const r of items) {
          const ref = reference?.[r.product_id];
          if (ref && same(ref, r)) delete next[r.product_id];
          else next[r.product_id] = r;
        }
        return next;
      });
      setToast(`${items.length === 1 ? "1 tamanho salvo" : `${items.length} tamanhos salvos`}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
    }
    setSaving(false);
  }

  function discard() {
    setDrafts(Object.fromEntries(ids.map((id) => [id, toDraft(savedOf(id))])));
    setError(null);
  }

  return (
    <div>
      {reference && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="desconto-lote" className="field-label">
              Desconto sobre a tabela da loja
            </label>
            <div className="flex items-center gap-2">
              <input
                id="desconto-lote"
                inputMode="decimal"
                className="field-input w-24 text-right tabular-nums"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
              <span className="font-semibold">%</span>
            </div>
          </div>
          <button type="button" className="btn btn-outline" onClick={applyPercent}>
            Aplicar a todos os tamanhos
          </button>
          <p className="basis-full text-sm text-ink-2">
            Recalcula preço e faixas a partir da loja. Depois ajuste o que quiser e salve. As faixas usam as
            quantidades da loja; aqui só o preço de cada faixa muda.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-10">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="border-b border-ink pb-2 text-lg font-bold">{group.title}</h2>
            <ul>
              {group.items.map((item) => {
                const draft = drafts[item.id];
                const result = parsed[item.id];
                const isOpen = open.has(item.id);
                const ref = reference?.[item.id];
                const dirty = changed.includes(item.id);
                // Sem linha própria e sem edição: o tamanho segue a tabela da loja
                const followsStore = !!ref && !saved[item.id] && !dirty;
                // "Usar a loja" só quando o rascunho difere da loja
                const canReset = !!ref && !followsStore && !("row" in result && same(result.row, ref));
                return (
                  <li key={item.id} className={`border-b border-rule py-3 ${dirty ? "bg-action-soft/30" : ""}`}>
                    <div className="grid gap-3 sm:grid-cols-[minmax(9rem,1.1fr)_9rem_minmax(0,2fr)] sm:items-center sm:gap-5">
                      <div className="min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-ink-2">
                          {ref && (followsStore ? <>Segue a loja: {formatBRL(ref.price_cents)}</> : <>Loja: {formatBRL(ref.price_cents)}</>)}
                          {ref && item.min > 1 && ", "}
                          {item.min > 1 && <>mínimo {item.min} fotos</>}
                        </p>
                      </div>
                      <label className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-2">R$</span>
                        <span className="sr-only">Preço por foto de {item.name}</span>
                        <input
                          inputMode="decimal"
                          className="field-input text-right tabular-nums"
                          value={draft.price}
                          onChange={(e) => update(item.id, (d) => ({ ...d, price: e.target.value }))}
                          onBlur={() => {
                            const c = parseMoney(draft.price);
                            if (c !== null) update(item.id, (d) => ({ ...d, price: toInput(c) }));
                          }}
                        />
                      </label>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        {!isOpen &&
                          ("row" in result && result.row.price_tiers.length ? (
                            result.row.price_tiers.map((t) => (
                              <span key={t.min} className="text-sm whitespace-nowrap text-ink-2 tabular-nums">
                                {t.min}+ fotos: {formatBRL(t.price_cents)}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-ink-3">
                              {reference ? "Sem desconto progressivo na loja" : "Sem desconto progressivo"}
                            </span>
                          ))}
                        {(!reference || draft.tiers.length > 0) && (
                          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isOpen} onClick={() => toggle(item.id)}>
                            {isOpen ? "Fechar faixas" : "Editar faixas"}
                          </button>
                        )}
                        {canReset && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => update(item.id, () => toDraft(ref))}
                          >
                            Usar a loja
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-2 rounded-control bg-paper p-3">
                        {draft.tiers.map((t, i) => (
                          <div key={t.key} className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">A partir de</span>
                            {reference ? (
                              <span className="font-semibold tabular-nums">{t.min}</span>
                            ) : (
                              <input
                                inputMode="numeric"
                                aria-label={`Quantidade da faixa ${i + 1}`}
                                className="field-input w-20 text-right tabular-nums"
                                value={t.min}
                                onChange={(e) =>
                                  update(item.id, (d) => ({
                                    ...d,
                                    tiers: d.tiers.map((x) => (x.key === t.key ? { ...x, min: e.target.value.replace(/\D/g, "") } : x)),
                                  }))
                                }
                              />
                            )}
                            <span className="text-sm">fotos, R$</span>
                            <input
                              inputMode="decimal"
                              aria-label={`Preço da faixa ${i + 1}`}
                              className="field-input w-24 text-right tabular-nums"
                              value={t.price}
                              onChange={(e) =>
                                update(item.id, (d) => ({
                                  ...d,
                                  tiers: d.tiers.map((x) => (x.key === t.key ? { ...x, price: e.target.value } : x)),
                                }))
                              }
                            />
                            <span className="text-sm">cada</span>
                            {!reference && (
                              <button
                                type="button"
                                className="inline-flex size-11 items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                                aria-label={`Remover a faixa ${i + 1}`}
                                onClick={() => update(item.id, (d) => ({ ...d, tiers: d.tiers.filter((x) => x.key !== t.key) }))}
                              >
                                <TrashIcon size={18} aria-hidden />
                              </button>
                            )}
                          </div>
                        ))}
                        {reference && (
                          <p className="text-sm text-ink-2">
                            Mesmas quantidades da loja. Faixa com o mesmo preço da anterior não muda nada.
                          </p>
                        )}
                        {!reference && draft.tiers.length < 10 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              update(item.id, (d) => {
                                const last = d.tiers[d.tiers.length - 1];
                                const min = last ? Number(last.min) * 2 || 200 : 100;
                                return { ...d, tiers: [...d.tiers, { key: nextKey++, min: String(min), price: "" }] };
                              })
                            }
                          >
                            <PlusIcon size={16} aria-hidden />
                            Adicionar faixa
                          </button>
                        )}
                      </div>
                    )}

                    {"error" in result && (
                      <p className="field-error" role="alert">
                        {result.error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Barra fixa: aparece quando há alteração para salvar */}
      {(changed.length > 0 || error) && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-rule bg-surface px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {error ? (
                <span className="text-danger">{error}</span>
              ) : (
                <>{changed.length === 1 ? "1 tamanho alterado" : `${changed.length} tamanhos alterados`}</>
              )}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={discard} disabled={saving}>
                Descartar
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !changed.length}>
                {saving && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-40 w-[min(100vw-2rem,30rem)] -translate-x-1/2 rounded-control bg-ink px-4 py-3 text-sm font-semibold text-surface shadow-lift"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
