import Image from "next/image";
import { paperLayout } from "@/lib/crop";
import type { Product } from "@/lib/types";

/** As seis lâminas do logo, na ordem do diafragma. */
export const BLADES = [
  "var(--color-blade-teal)",
  "var(--color-blade-mustard)",
  "var(--color-blade-rust)",
  "var(--color-blade-plum)",
  "var(--color-blade-indigo)",
  "var(--color-blade-olive)",
];

export function bladeFor(index: number) {
  return BLADES[((index % BLADES.length) + BLADES.length) % BLADES.length];
}

/**
 * Fotos de exemplo, já recortadas em retrato (2:3). Origem e licença em design/IMAGES.md.
 * Nenhuma mostra rosto reconhecível.
 */
export const SAMPLE_PHOTOS = [
  "/fotos-exemplo/pai-e-filho-praia.jpg",
  "/fotos-exemplo/mae-e-filha-por-do-sol.jpg",
  "/fotos-exemplo/mao-de-bebe.jpg",
  "/fotos-exemplo/filhote-na-praia.jpg",
  "/fotos-exemplo/por-do-sol-na-praia.jpg",
  "/fotos-exemplo/mao-de-bebe-pb.jpg",
];

export function samplePhotoFor(index: number) {
  return SAMPLE_PHOTOS[((index % SAMPLE_PHOTOS.length) + SAMPLE_PHOTOS.length) % SAMPLE_PHOTOS.length];
}

/**
 * Uma foto impressa desenhada em escala: papel branco com um fio de borda e, dentro, uma foto de exemplo
 * (ou só a cor de uma lâmina do logo). Sempre em pé (retrato).
 * A escala vem de `scale` (px por cm) ou, sem ela, da variável CSS --cm do contêiner, o que permite
 * mudar a escala por tamanho de tela.
 */
export function PrintShape({
  product,
  scale,
  color,
  photo,
  className = "",
}: {
  product: Pick<Product, "width_cm" | "height_cm" | "kind"> & { id?: string };
  scale?: number;
  color: string;
  photo?: string;
  className?: string;
}) {
  const shortCm = Math.min(product.width_cm, product.height_cm);
  const longCm = Math.max(product.width_cm, product.height_cm);
  const cm = (value: number) => (scale ? `${Math.round(value * scale)}px` : `calc(var(--cm, 6px) * ${value})`);
  const polaroid = product.kind === "polaroid";
  // Foto comum sai sem borda: o fio branco só faz o desenho ler como papel.
  // Polaroid e Mini Polaroid: a moldura do filme, a mesma do arquivo de impressão (paperLayout).
  const frame = polaroid ? paperLayout(product, false) : null;
  const padding = frame
    ? [frame.window.y, frame.window.x, frame.height - frame.window.y - frame.window.h, frame.window.x]
        .map((mm) => `max(2px, ${cm(mm / 10)})`)
        .join(" ")
    : "2px";

  return (
    <div
      aria-hidden
      className={`print shrink-0 ${className}`}
      style={{
        width: cm(shortCm),
        height: cm(longCm),
        padding,
      }}
    >
      <div className="relative size-full overflow-hidden rounded-[1px]" style={{ background: color }}>
        {photo && <Image src={photo} alt="" fill sizes="240px" className="object-cover" />}
      </div>
    </div>
  );
}
