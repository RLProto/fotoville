import Link from "next/link";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/lib/types";
import { bladeFor, PrintShape, SAMPLE_PHOTOS } from "./print-shape";

/** Medida de um celular comum (em pé), para dar a referência de escala. */
const PHONE = { width_cm: 7.2, height_cm: 15 };

/**
 * Régua de tamanhos: as fotos desenhadas na mesma escala, lado a lado, com um celular de
 * referência. No celular vira uma faixa com rolagem horizontal.
 */
export function SizeBoard({ products, onColor = false }: { products: Product[]; onColor?: boolean }) {
  // Sobre o campo petróleo o texto vira claro; no papel, segue a tinta
  const muted = onColor ? "text-[#d6e1e1]" : "text-ink-2";
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 [--cm:4px] [scrollbar-width:thin] sm:mx-0 sm:px-0 sm:[--cm:6px]">
      <ul className="flex min-w-max items-end gap-6 sm:gap-8" aria-label="Tamanhos em escala">
        <li className="flex flex-col items-center gap-3">
          <div
            aria-hidden
            className={`rounded-[14px] border-2 border-dashed ${onColor ? "border-surface/60" : "border-field"}`}
            style={{ width: `calc(var(--cm) * ${PHONE.width_cm})`, height: `calc(var(--cm) * ${PHONE.height_cm})` }}
          />
          <p className={`text-sm ${muted}`}>Seu celular</p>
          {/* reserva a altura da linha de preço para alinhar os nomes */}
          <p className="text-sm" aria-hidden>
            &nbsp;
          </p>
        </li>
        {products.map((product, i) => (
          <li key={product.id}>
            <Link
              href={`/enviar/${product.id}`}
              className={`group flex flex-col items-center gap-3 rounded-control px-1 pt-1 ${onColor ? "focus-visible:outline-surface" : ""}`}
              aria-label={`${product.name}, ${formatBRL(product.price_cents)} por foto. Enviar fotos neste tamanho`}
            >
              <PrintShape
                product={product}
                color={bladeFor(i)}
                photo={SAMPLE_PHOTOS[0]}
                className="transition-transform duration-200 ease-out group-hover:-translate-y-1.5"
              />
              <p className="text-sm font-semibold whitespace-nowrap">{product.name}</p>
              <p
                className={`text-sm whitespace-nowrap tabular-nums ${muted} ${onColor ? "group-hover:text-surface group-hover:underline" : "group-hover:text-action"}`}
              >
                {formatBRL(product.price_cents)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
