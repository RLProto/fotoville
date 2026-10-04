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
    "Todos os tamanhos de revelação da Fotoville, de 10x15 a 30x60, Polaroid e foto-placa. Escolha o tamanho e envie suas fotos.",
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
              <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
                {items.map((product) => {
                  const onlyFinish =
                    product.finishes.length === 1 && !product.name.toLowerCase().includes(product.finishes[0])
                      ? FINISH_LABEL[product.finishes[0]].toLowerCase()
                      : null;
                  return (
                    <li key={product.id}>
                      <Link
                        href={`/enviar/${product.id}`}
                        className="group block h-full rounded-panel border border-rule bg-surface p-3 transition-colors duration-150 hover:border-action sm:p-4"
                        aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
                      >
                        {/* Todas com a mesma altura: o desenho mostra a proporção do papel, não o tamanho */}
                        <div className="flex items-center justify-center rounded-control bg-paper" style={{ height: STAGE_PX + 32 }}>
                          <PrintShape
                            product={product}
                            scale={STAGE_PX / Math.max(product.width_cm, product.height_cm)}
                            color={bladeFor(g)}
                            photo={samplePhotoFor(g)}
                            className="transition-transform duration-200 ease-out group-hover:-translate-y-1"
                          />
                        </div>
                        <h3 className="mt-3 font-semibold">
                          {product.name}
                          {onlyFinish && <span className="ml-1.5 text-sm font-normal text-ink-2">só {onlyFinish}</span>}
                        </h3>
                        <p className="font-display text-lg font-extrabold tabular-nums group-hover:text-action">
                          {formatBRL(product.price_cents)}
                        </p>
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
