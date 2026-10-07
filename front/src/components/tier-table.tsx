import { formatBRL } from "@/lib/format";
import { quantityRanges, rangeLabel, unitPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";

/**
 * Tabela do desconto progressivo: uma linha por faixa de quantidade, uma coluna por tamanho
 * (10x15, 15x21...). Serve para a home e para a aba Preços.
 */
export function TierTable({ products, onColor = false }: { products: Product[]; onColor?: boolean }) {
  const tiered = products.filter((p) => p.price_tiers.length > 0);
  if (!tiered.length) return null;
  const ranges = quantityRanges(tiered);
  // Sobre o campo mostarda a tabela é um painel branco; no papel, um cartão com borda
  const shell = onColor ? "rounded-panel bg-surface" : "card";

  return (
    <div className={`${shell} overflow-x-auto`}>
      <table className="w-full text-left tabular-nums">
        <thead className="border-b border-rule text-sm text-ink-2">
          <tr>
            <th scope="col" className="px-3 py-3 font-semibold sm:px-5">
              Fotos
            </th>
            {tiered.map((p) => (
              <th key={p.id} scope="col" className="px-3 py-3 text-right font-semibold whitespace-nowrap sm:px-5">
                {p.name.replace(" cm", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => (
            <tr key={range.from} className="border-b border-rule last:border-b-0">
              <th scope="row" className="px-3 py-3 font-semibold whitespace-nowrap sm:px-5">
                {rangeLabel(range)}
              </th>
              {tiered.map((p) => {
                const price = unitPrice(p, range.from);
                const off = Math.round((1 - price / p.price_cents) * 100);
                return (
                  <td key={p.id} className="px-3 py-3 text-right whitespace-nowrap sm:px-5">
                    {/* A porcentagem só cabe a partir de 640 px; no celular ficam os preços */}
                    {off > 0 && <span className="badge mr-2 hidden bg-success-soft text-success sm:inline-flex">−{off}%</span>}
                    <span className="font-display text-lg font-bold">{formatBRL(price)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "10x15 e 15x21", para frases. */
export function tieredNames(products: Product[]) {
  const names = products.filter((p) => p.price_tiers.length > 0).map((p) => p.name.replace(" cm", ""));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names.join("");
}
