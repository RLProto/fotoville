import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getProducts } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { minCopies, quantityRanges, rangeLabel, unitPrice } from "@/lib/pricing";
import { SIZE_GROUPS } from "@/lib/size-groups";
import { FINISH_LABEL } from "@/lib/types";

export const metadata: Metadata = {
  title: "Preços de revelação de fotos",
  description:
    "Preço por foto do 10x13 ao 30x60, Polaroid e foto-placa. Desconto progressivo no 10x15. Entrega em todo o Brasil ou retirada em Joinville/SC.",
};

const shortName = (name: string) => name.replace(" cm", "");
const listNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names.join("");

export default async function PrecosPage() {
  const products = await getProducts();
  const tiered = products.filter((p) => p.price_tiers.length > 0);
  const ranges = quantityRanges(tiered);
  const single = tiered.length === 1 ? tiered[0] : null;
  const hasProfile = products.some((p) => p.store);

  return (
    <>
      <PageHeader title="Preços">
        <p>{hasProfile ? "Preço por foto, com o seu desconto de cliente." : "Preço por foto."}</p>
      </PageHeader>

      <section aria-labelledby="tamanhos">
        <div className="container-page py-14">
          <h2 id="tamanhos" className="display-md text-2xl sm:text-3xl">
            Todos os tamanhos
          </h2>

          {/* Duas colunas no desktop: ampliações (a lista longa) à direita, ocupando a altura toda */}
          <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
            {SIZE_GROUPS.map((group, g) => {
              const items = products.filter(group.match);
              if (!items.length) return null;
              return (
                <section key={group.title} aria-labelledby={`lista-${g}`} className={`min-w-0 ${g === 1 ? "lg:row-span-2" : ""}`}>
                  <h3 id={`lista-${g}`} className="border-b border-rule pb-2 text-lg font-bold">
                    {group.title}
                  </h3>
                  <ul className="mt-2">
                    {items.map((product) => {
                      const onlyFinish =
                        product.finishes.length === 1 && !product.name.toLowerCase().includes(product.finishes[0])
                          ? FINISH_LABEL[product.finishes[0]].toLowerCase()
                          : null;
                      return (
                        <li key={product.id}>
                          <Link
                            href={`/enviar/${product.id}`}
                            className="group flex items-center rounded-control px-2 py-2.5 transition-colors duration-150 hover:bg-ink/[0.04]"
                            aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
                          >
                            {/* O nome pode quebrar de linha (fonte grande); o preço fica sempre inteiro à direita */}
                            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold">{product.name}</span>
                              {onlyFinish && <span className="text-sm text-ink-2">só {onlyFinish}</span>}
                              {minCopies(product) > 1 && <span className="text-sm text-ink-2">mínimo {minCopies(product)}</span>}
                            </span>
                            <span className="leader" aria-hidden />
                            <span className="shrink-0 text-right tabular-nums group-hover:text-action">
                              {product.store && product.store.price_cents > product.price_cents && (
                                <s className="block text-xs leading-tight text-ink-3">
                                  <span className="sr-only">de </span>
                                  {formatBRL(product.store.price_cents)}
                                </s>
                              )}
                              {formatBRL(product.price_cents)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {tiered.length > 0 && (
        <section className="border-t border-rule" aria-labelledby="quantidade">
          <div className="container-page grid items-start gap-8 py-14 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
            <div>
              <h2 id="quantidade" className="display-md text-2xl sm:text-3xl">
                Desconto progressivo
              </h2>
              <p className="mt-3 max-w-[40ch] text-lg text-ink-2">
                {single
                  ? `Descontos válidos para o tamanho ${shortName(single.name)}.`
                  : `Descontos válidos para os tamanhos ${listNames(tiered.map((p) => shortName(p.name)))}.`}
              </p>
              <p className="mt-6 max-w-[40ch]">
                Para pagar antes e revelar aos poucos, veja os{" "}
                <Link href="/promocoes" className="link">
                  pacotes pré-pagos
                </Link>
                .
              </p>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead className="border-b border-rule text-sm text-ink-2">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Fotos
                    </th>
                    {single ? (
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Preço por foto
                      </th>
                    ) : (
                      tiered.map((p) => (
                        <th key={p.id} scope="col" className="px-5 py-3 text-right font-semibold">
                          {p.name}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((range) => (
                    <tr key={range.from} className="border-b border-rule last:border-b-0">
                      <th scope="row" className="px-5 py-3.5 font-semibold whitespace-nowrap">
                        {rangeLabel(range)}
                      </th>
                      {tiered.map((p) => {
                        const price = unitPrice(p, range.from);
                        const off = Math.round((1 - price / p.price_cents) * 100);
                        return (
                          <td key={p.id} className="px-5 py-3.5 text-right whitespace-nowrap">
                            {off > 0 && <span className="badge mr-3 bg-success-soft text-success">−{off}%</span>}
                            <span className="font-display text-lg font-bold">{formatBRL(price)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <div className="border-t border-rule">
        <div className="container-page flex flex-wrap items-center gap-x-8 gap-y-4 py-10">
          <Link href="/enviar" className="btn btn-accent btn-lg">
            Enviar fotos
          </Link>
          <p className="text-ink-2">
            Frete à parte.{" "}
            <Link href="/prazos-e-frete" className="link">
              Consultar prazos e frete
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
