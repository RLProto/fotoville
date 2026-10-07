import { formatBRL } from "@/lib/format";
import { quantityRanges, rangeLabel, unitPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";

/**
 * Desconto progressivo: um cartão por tamanho, com as faixas em linhas de balcão
 * (quantidade, pontilhado, preço) e a porcentagem discreta ao lado. Serve para a home e para a aba Preços.
 */
export function TierTable({ products, onColor = false }: { products: Product[]; onColor?: boolean }) {
  const tiered = products.filter((p) => p.price_tiers.length > 0);
  if (!tiered.length) return null;
  const shell = onColor ? "rounded-panel bg-surface" : "card";

  return (
    <div className={`grid min-w-0 gap-4 ${tiered.length > 1 ? "sm:grid-cols-2" : "max-w-sm"}`}>
      {tiered.map((p) => {
        const ranges = quantityRanges([p]);
        return (
          <section key={p.id} className={`${shell} min-w-0 px-4 pt-5 pb-3 sm:px-5`} aria-label={`Desconto progressivo ${p.name}`}>
            <h3 className="flex items-baseline justify-between gap-3">
              <span className="font-display text-2xl font-extrabold tabular-nums">
                {p.name.replace(" cm", "")}
                {p.kind === "print" && <span className="ml-1 text-sm font-semibold text-ink-2">cm</span>}
              </span>
              <span className="text-sm text-ink-2">por foto</span>
            </h3>
            <ul className="mt-3">
              {ranges.map((range) => {
                const price = unitPrice(p, range.from);
                const off = Math.round((1 - price / p.price_cents) * 100);
                // Com fonte muito grande a linha quebra e o preço desce para a direita, em vez de vazar
                return (
                  <li key={range.from} className="flex flex-wrap items-baseline border-t border-rule py-2.5">
                    <span className="font-semibold whitespace-nowrap tabular-nums">{rangeLabel(range)}</span>
                    <span className="leader min-w-2" aria-hidden />
                    <span className="ml-auto flex items-baseline whitespace-nowrap">
                      <span className="font-display font-bold tabular-nums">{formatBRL(price)}</span>
                      {/* Coluna fixa para a porcentagem: os preços ficam alinhados mesmo na linha sem desconto */}
                      <span className="ml-2 w-[4.5ch] shrink-0 text-right text-sm font-semibold text-success tabular-nums">
                        {off > 0 ? `−${off}%` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** "10x15 e 15x21", para frases. */
export function tieredNames(products: Product[]) {
  const names = products.filter((p) => p.price_tiers.length > 0).map((p) => p.name.replace(" cm", ""));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names.join("");
}
