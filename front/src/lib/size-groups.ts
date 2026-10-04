import type { Product } from "./types";

/** Grupos de tamanho usados na escolha do tamanho e na tabela de preços. */
export const SIZE_GROUPS: { title: string; match: (p: Product) => boolean }[] = [
  { title: "Álbum e porta-retrato", match: (p) => p.kind === "print" && Math.max(p.width_cm, p.height_cm) <= 21 },
  { title: "Ampliações", match: (p) => p.kind === "print" && Math.max(p.width_cm, p.height_cm) > 21 },
  { title: "Especiais", match: (p) => p.kind !== "print" },
];
