import type { Adjust, BorderColor, CaptionFont, Product } from "./types";

export const DEFAULT_ADJUST: Adjust = {
  auto: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  bw: false,
  border: null,
  caption: null,
};

export const BORDER_COLORS: { id: BorderColor; label: string; hex: string }[] = [
  { id: "branco", label: "Branca", hex: "#ffffff" },
  { id: "marfim", label: "Marfim", hex: "#f1eadb" },
  { id: "preto", label: "Preta", hex: "#1c1c1e" },
  { id: "rosa", label: "Rosa", hex: "#e8c4c0" },
  { id: "azul", label: "Azul", hex: "#bccfe2" },
  { id: "salvia", label: "Sálvia", hex: "#b7c6ae" },
  { id: "mostarda", label: "Mostarda", hex: "#d9b45a" },
  { id: "terracota", label: "Terracota", hex: "#b4532f" },
];

export const BORDER_MM = { min: 2, max: 15, initial: 5 };

/** Rótulos das fontes da legenda. As fontes em si ficam em caption-fonts.ts (só no navegador). */
export const CAPTION_FONT_LABEL: Record<CaptionFont, string> = {
  caneta: "Caneta",
  caligrafia: "Caligrafia",
  classica: "Clássica",
  maquina: "Máquina",
  retro: "Retrô",
};

export const CAPTION_MAX = 40;
export const CAPTION_COLOR = "#26262b";

export const borderHex = (id: BorderColor) => BORDER_COLORS.find((c) => c.id === id)?.hex ?? "#ffffff";

/** Há alguma mudança de cor ou tom para aplicar nos pixels? */
export function hasToneChange(a: Adjust | null): boolean {
  return Boolean(a && (a.auto || a.bw || a.brightness || a.contrast || a.saturation));
}

/** Nada a aplicar: pode ser gravado como null. */
export const isNeutralAdjust = (a: Adjust) => !hasToneChange(a) && !a.border && !a.caption;

/** Descarta o que não vale para o tipo de papel: borda na Polaroid, legenda fora dela. */
export function normalizeAdjust(adjust: Adjust, product: Pick<Product, "kind">): Adjust {
  const polaroid = product.kind === "polaroid";
  const text = adjust.caption?.text.replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX) ?? "";
  return {
    ...adjust,
    border: polaroid ? null : adjust.border,
    caption: polaroid && adjust.caption && text ? { ...adjust.caption, text } : null,
  };
}

/** Resumo dos ajustes para a equipe da loja. */
export function describeAdjust(a: Adjust | null): string[] {
  if (!a) return [];
  const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  const out: string[] = [];
  if (a.auto) out.push("ajuste automático");
  if (a.bw) out.push("preto e branco");
  if (a.brightness) out.push(`brilho ${signed(a.brightness)}`);
  if (a.contrast) out.push(`contraste ${signed(a.contrast)}`);
  if (a.saturation && !a.bw) out.push(`saturação ${signed(a.saturation)}`);
  if (a.border) {
    const color = BORDER_COLORS.find((c) => c.id === a.border!.color)?.label.toLowerCase();
    out.push(`borda ${color} de ${a.border.mm} mm`);
  }
  if (a.caption) out.push(`legenda “${a.caption.text}” (${CAPTION_FONT_LABEL[a.caption.font].toLowerCase()})`);
  return out;
}
