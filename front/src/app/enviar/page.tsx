import type { Metadata } from "next";
import Link from "next/link";
import { OrderSteps } from "@/components/order-steps";
import { getProducts } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { minCopies } from "@/lib/pricing";
import { SIZE_GROUPS } from "@/lib/size-groups";
import { FINISH_LABEL, type Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Enviar fotos: escolha o tamanho",
  description:
    "Tamanhos de revelação do 10x13 ao 30x60, Polaroid e foto-placa, a partir de R$ 1,99 por foto. Entrega em todo o Brasil ou retirada em Joinville/SC.",
};

const cmFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Medida no padrão do envelope: "10 × 15", com o sinal mais leve que os números. */
function Measure({ w, h }: { w: number; h: number }) {
  return (
    <>
      {cmFormat.format(w)}
      <span className="mx-[0.12em] font-semibold text-ink-3">×</span>
      {cmFormat.format(h)}
    </>
  );
}

/** O que vai em destaque no cartão e as linhas pequenas embaixo, conforme o tipo de produto. */
function cardText(product: Product): { main: React.ReactNode; unit: string | null; notes: React.ReactNode[] } {
  const notes: React.ReactNode[] = [];
  if (product.finishes.length === 1) notes.push(`Só ${FINISH_LABEL[product.finishes[0]].toLowerCase()}`);
  if (product.kind === "print") {
    return { main: <Measure w={product.width_cm} h={product.height_cm} />, unit: "cm", notes };
  }
  if (product.kind === "placa") {
    // Mesmo padrão dos outros: a medida em destaque, o tipo na linha pequena
    return { main: <Measure w={product.width_cm} h={product.height_cm} />, unit: "cm", notes: ["Foto-placa", ...notes] };
  }
  // Polaroid e Mini Polaroid: o nome é o que o cliente conhece; a medida vai embaixo
  const min = minCopies(product);
  return {
    main: product.name,
    unit: null,
    notes: [
      <>
        <Measure w={product.width_cm} h={product.height_cm} /> cm
      </>,
      ...(min > 1 ? [`Mínimo de ${min} fotos`] : []),
      ...notes,
    ],
  };
}

export default async function EscolherTamanhoPage() {
  const products = await getProducts();

  return (
    <div className="container-page py-8">
      <OrderSteps current={1} />
      <h1 className="mt-3 display-md text-3xl sm:text-4xl">Escolha o tamanho</h1>
      <p className="mt-1 text-lg text-ink-2">Preço por foto. Pode misturar tamanhos no mesmo pedido.</p>

      <div className="mt-10 space-y-12">
        {SIZE_GROUPS.map((group, g) => {
          const items = products.filter(group.match);
          if (!items.length) return null;
          return (
            <section key={group.title} aria-labelledby={`grupo-${g}`}>
              <h2 id={`grupo-${g}`} className="display-md border-b border-rule pb-3 text-2xl">
                {group.title}
              </h2>
              {/*
                Cartões só com medida e preço, como o canhoto do envelope de laboratório.
                Largura mínima em rem: a grade escolhe sozinha quantas colunas cabem, inclusive com a fonte
                do sistema aumentada (360 px: duas colunas; desktop: sete, os 7 tamanhos de álbum numa linha).
              */}
              <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2.5 sm:gap-3">
                {items.map((product) => {
                  const { main, unit, notes } = cardText(product);
                  return (
                    <li key={product.id}>
                      <Link
                        href={`/enviar/${product.id}`}
                        className="group flex h-full flex-col rounded-panel border border-rule bg-surface px-4 pt-4 pb-3.5 transition-[border-color,background-color] duration-150 hover:border-action hover:bg-action-soft/40"
                        aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
                      >
                        <h3 className="font-display text-[1.7rem] leading-none font-extrabold tracking-[-0.01em] tabular-nums">
                          {main}
                          {unit && <span className="ml-1 text-sm font-semibold tracking-normal text-ink-2">{unit}</span>}
                        </h3>
                        {notes.map((n, i) => (
                          <p key={i} className={`text-sm text-ink-2 ${i === 0 ? "mt-1.5" : ""}`}>
                            {n}
                          </p>
                        ))}

                        {/* Picote fino entre a medida e o preço; o preço fica sempre no pé do cartão */}
                        <div className="mt-auto pt-5">
                          <p className="border-t border-dashed border-rule pt-3">
                            <span className="font-display text-lg font-bold tabular-nums transition-colors duration-150 group-hover:text-action">
                              {formatBRL(product.price_cents)}
                            </span>
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
