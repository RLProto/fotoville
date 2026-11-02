"use client";

import { CheckCircleIcon, CircleNotchIcon, FilePdfIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";
import { buildLabelsPdf, LABELS_PER_SHEET, type LabelData } from "@/lib/order-label";
import { reportError } from "@/lib/report-error";

export type LabelRow = {
  id: string;
  /** Uma por pedido; duas só quando há tamanhos demais para uma. */
  labels: LabelData[];
  readyAt: string;
  printedAt: string | null;
};

/** Próxima etiqueta livre da folha, lembrada neste navegador: a folha volta para a impressora pela metade. */
const NEXT_KEY = "fotoville-etiqueta-posicao";
const subscribeNoop = () => () => {};
function storedStart() {
  try {
    const value = Number(window.localStorage.getItem(NEXT_KEY));
    return value >= 1 && value <= LABELS_PER_SHEET ? value : 1;
  } catch {
    return 1;
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Etiquetas dos pedidos já baixados: escolhe quais entram no PDF, que as marca como impressas. */
export function LabelsTable({ rows }: { rows: LabelRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stored = useSyncExternalStore(subscribeNoop, storedStart, () => 1);
  const [typedStart, setTypedStart] = useState<number | null>(null);
  const start = typedStart ?? stored;

  const chosen = rows.filter((r) => selected.has(r.id));
  const count = chosen.reduce((sum, r) => sum + r.labels.length, 0);
  // A caixa do cabeçalho pega só as que faltam imprimir: reimprimir é escolha de uma a uma
  const waiting = rows.filter((r) => !r.printedAt);
  const allWaiting = waiting.length > 0 && waiting.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function generate() {
    setBusy(true);
    setMessage(null);
    try {
      const pdf = await buildLabelsPdf(chosen.flatMap((r) => r.labels), start);
      const date = new Date().toLocaleDateString("sv-SE");
      save(new Blob([pdf as BlobPart], { type: "application/pdf" }), `etiquetas_${date}.pdf`);

      const next = ((start - 1 + count) % LABELS_PER_SHEET) + 1;
      setTypedStart(next);
      try {
        window.localStorage.setItem(NEXT_KEY, String(next));
      } catch {
        // Navegador sem armazenamento: a posição só não fica lembrada
      }

      const res = await fetch("/api/admin/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chosen.map((r) => r.id) }),
      }).catch(() => null);
      setSelected(new Set());
      setMessage(
        res?.ok
          ? `PDF gerado com ${count} ${count === 1 ? "etiqueta" : "etiquetas"}.`
          : "PDF gerado, mas não foi possível marcar como impressas.",
      );
      router.refresh();
    } catch (err) {
      reportError("loja", err, { etapa: "gerar etiquetas", count });
      setMessage("Não foi possível gerar o PDF. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" className="btn btn-primary" disabled={busy || count === 0} onClick={generate}>
          {busy ? (
            <CircleNotchIcon size={18} className="spinner" aria-hidden />
          ) : (
            <FilePdfIcon size={18} aria-hidden />
          )}
          Gerar PDF ({count})
        </button>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Começar na etiqueta
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={LABELS_PER_SHEET}
            value={start}
            onChange={(e) => {
              const value = Math.round(Number(e.target.value));
              if (value >= 1 && value <= LABELS_PER_SHEET) setTypedStart(value);
            }}
            className="field-input w-20"
          />
          <span className="font-normal text-ink-2">de {LABELS_PER_SHEET}</span>
        </label>
        <p aria-live="polite" className="min-h-5 text-sm font-semibold">
          {message}
        </p>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">Etiquetas</caption>
          <thead className="border-b border-rule text-sm text-ink-2">
            <tr>
              <th scope="col" className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as etiquetas não impressas"
                  title="Selecionar as não impressas"
                  checked={allWaiting}
                  disabled={waiting.length === 0}
                  onChange={() => setSelected(allWaiting ? new Set() : new Set(waiting.map((r) => r.id)))}
                  className="size-5 accent-action"
                />
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Pedido
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Cliente
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Entrega
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Tamanhos
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Disponível desde
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { number, customer, address } = row.labels[0];
              const sizes = row.labels.flatMap((l) => l.sizes);
              return (
                <tr key={row.id} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar etiqueta do pedido ${number}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-5 accent-action"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    <Link href={`/admin/pedidos/${row.id}`} className="link">
                      #{number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customer}</td>
                  <td className="px-4 py-3">{address ? address.city : "Retirada na loja"}</td>
                  <td className="px-4 py-3">
                    {sizes.join(", ")}
                    {row.labels.length > 1 && <span className="block text-xs text-ink-2">{row.labels.length} etiquetas</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.readyAt)}</td>
                  <td className="px-4 py-3">
                    {row.printedAt ? (
                      <span className="badge bg-action-soft text-action" title={`Em ${formatDate(row.printedAt)}`}>
                        <CheckCircleIcon size={14} weight="fill" aria-hidden />
                        Etiqueta impressa
                      </span>
                    ) : (
                      <span className="text-ink-2">Não impressa</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
