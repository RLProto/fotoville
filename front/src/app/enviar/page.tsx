import type { Metadata } from "next";
import Link from "next/link";
import { OrderSteps } from "@/components/order-steps";
import { bladeFor, PrintShape, samplePhotoFor } from "@/components/print-shape";
import { getProducts } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { SIZE_GROUPS } from "@/lib/size-groups";
import { FINISH_LABEL } from "@/lib/types";

export const metadata: Metadata = {
  title: "Enviar fotos: escolha o tamanho",
  description:
    "Tamanhos de revelação do 10x13 ao 30x60, Polaroid e foto-placa, a partir de R$ 1,99 por foto. Entrega em todo o Brasil ou retirada em Joinville/SC.",
};

/** Altura do desenho de cada tamanho, em px. */
const STAGE_PX = 112;

export default async function EscolherTamanhoPage() {
  const products = await getProducts();

  return (
    <div className="container-page py-8">
      <OrderSteps current={1} />
      <h1 className="mt-3 display-md text-3xl sm:text-4xl">Escolha o tamanho</h1>
      <p className="mt-1 text-lg text-ink-2">Preço por foto. Pode misturar tamanhos no mesmo pedido.</p>

      <div className="mt-10 space-y-14">
        {SIZE_GROUPS.map((group, g) => {
          const items = products.filter(group.match);
          if (!items.length) return null;
          return (
            <section key={group.title} aria-labelledby={`grupo-${g}`}>
              <h2 id={`grupo-${g}`} className="display-md border-b border-rule pb-3 text-2xl">
                {group.title}
              </h2>
              <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
                {items.map((product) => {
                  const onlyFinish =
                    product.finishes.length === 1 && !product.name.toLowerCase().includes(product.finishes[0])
                      ? FINISH_LABEL[product.finishes[0]].toLowerCase()
                      : null;
                  return (
                    <li key={product.id}>
                      <Link
                        href={`/enviar/${product.id}`}
                        className="group flex h-full items-center gap-3 rounded-panel border border-rule bg-surface p-2.5 transition-colors duration-150 hover:border-action sm:block sm:p-4"
                        aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
                      >
                        {/*
                          Todas com a mesma altura: o desenho mostra a proporção do papel, não o tamanho.
                          No celular o cartão deita (foto pequena à esquerda) para a lista não ficar longa.
                        */}
                        <div
                          className="flex h-[72px] w-16 shrink-0 items-center justify-center rounded-control bg-paper sm:h-[144px] sm:w-auto sm:[--cm:var(--cm-lg)]"
                          style={
                            {
                              "--cm": `${56 / Math.max(product.width_cm, product.height_cm)}px`,
                              "--cm-lg": `${STAGE_PX / Math.max(product.width_cm, product.height_cm)}px`,
                            } as React.CSSProperties
                          }
                        >
                          <PrintShape
                            product={product}
                            color={bladeFor(g)}
                            photo={samplePhotoFor(g)}
                            className="transition-transform duration-200 ease-out sm:group-hover:-translate-y-1"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold sm:mt-3">
                            {product.name}
                            {onlyFinish && <span className="ml-1.5 text-sm font-normal text-ink-2">só {onlyFinish}</span>}
                          </h3>
                          <p className="font-display text-lg font-extrabold tabular-nums group-hover:text-action">
                            {formatBRL(product.price_cents)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <p className="text-lg">
          <Link href="/precos" className="link">
            Tabela de preços e descontos
          </Link>
        </p>
      </div>
    </div>
  );
}
