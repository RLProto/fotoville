import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TierTable, tieredNames } from "@/components/tier-table";
import { getProducts } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { minCopies } from "@/lib/pricing";
import { SIZE_GROUPS } from "@/lib/size-groups";

export const metadata: Metadata = {
  title: "Preços de revelação de fotos",
  description:
    "Preço por foto do 10x13 ao 30x60, Polaroid, Polaroid ímã e foto-placa. Desconto progressivo no 10x15 e no 15x21. Entrega em todo o Brasil ou retirada em Joinville/SC.",
};

export default async function PrecosPage() {
  const products = await getProducts();
  const tiered = products.filter((p) => p.price_tiers.length > 0);
  const hasProfile = products.some((p) => p.store);

  return (
    <>
      <PageHeader title="Preços">
        <p>{hasProfile ? "Preço por foto, com o seu desconto de cliente." : "Preço por foto."}</p>
        {tiered.length > 0 && (
          <p className="mt-2">
            <a href="#quantidade" className="link">
              Desconto progressivo no {tieredNames(products)}
            </a>
            : quanto mais fotos, menor o preço.
          </p>
        )}
      </PageHeader>

      <section aria-labelledby="revelacao">
        <div className="container-page py-14">
          <h2 id="revelacao" className="display-md text-2xl sm:text-3xl">
            Revelação de fotos
          </h2>

          <div className="mt-8 space-y-12">
            {SIZE_GROUPS.map((group, g) => {
              const items = products.filter(group.match);
              if (!items.length) return null;
              return (
                <section key={group.title} aria-labelledby={`lista-${g}`} className="min-w-0">
                  <h3 id={`lista-${g}`} className="border-b border-rule pb-2 text-lg font-bold">
                    {group.title}
                  </h3>
                  {/* Lista longa em duas colunas no desktop; cada linha fica inteira numa coluna */}
                  <ul className={`mt-2 ${items.length > 6 ? "lg:columns-2 lg:gap-x-14" : ""}`}>
                    {items.map((product) => (
                      <li key={product.id} className="break-inside-avoid">
                        <Link
                          href={`/enviar/${product.id}`}
                          className="group flex items-center rounded-control px-2 py-2.5 transition-colors duration-150 hover:bg-ink/[0.04]"
                          aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
                        >
                          {/* O nome pode quebrar de linha (fonte grande); o preço fica sempre inteiro à direita */}
                          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold">{product.name}</span>
                            {product.price_tiers.length > 0 && (
                              <span className="badge bg-success-soft whitespace-normal text-success">desconto progressivo</span>
                            )}
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
                    ))}
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
              <h2 id="quantidade" className="display-md scroll-mt-24 text-2xl sm:text-3xl">
                Desconto progressivo
              </h2>
              <p className="mt-3 max-w-[40ch] text-lg text-ink-2">
                Vale para {tieredNames(products)}. Conta o total de fotos de cada tamanho no pedido.
              </p>
              <p className="mt-6 max-w-[40ch]">
                Para pagar antes e revelar aos poucos, veja os{" "}
                <Link href="/promocoes" className="link">
                  pacotes pré-pagos
                </Link>
                .
              </p>
            </div>
            <TierTable products={products} />
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
