import type { Product } from "./types";

/** Grupos de tamanho usados na escolha do tamanho, na tabela de preços e no painel. */
export const SIZE_GROUPS: { title: string; match: (p: Product) => boolean }[] = [
  { title: "Tamanhos", match: (p) => p.kind === "print" },
  { title: "Especiais", match: (p) => p.kind !== "print" },
];
