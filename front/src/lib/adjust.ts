import type { Adjust, BorderColor, CaptionFont, Product } from "./types";

export const DEFAULT_ADJUST: Adjust = {
  auto: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  bw: false,
  border: null,
  caption: null,
  frame: null,
};

/** Cores da borda e da moldura da Polaroid. `dark`: a legenda sai branca sobre ela. */
export const BORDER_COLORS: { id: BorderColor; label: string; hex: string; dark?: boolean }[] = [
  { id: "branco", label: "Branca", hex: "#ffffff" },
  { id: "marfim", label: "Marfim", hex: "#f1eadb" },
  { id: "preto", label: "Preta", hex: "#1c1c1e", dark: true },
  { id: "rosa", label: "Rosa", hex: "#e8c4c0" },
  { id: "azul", label: "Azul", hex: "#bccfe2" },
  { id: "salvia", label: "Sálvia", hex: "#b7c6ae" },
  { id: "mostarda", label: "Mostarda", hex: "#d9b45a" },
  { id: "terracota", label: "Terracota", hex: "#b4532f", dark: true },
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
const CAPTION_COLOR = "#26262b";

/** Emojis à mão no editor da legenda. O teclado do celular continua valendo para os outros. */
export const CAPTION_EMOJIS = [
  "❤️", "😍", "🥰", "😊", "😂", "😎", "🎉", "🎂", "🎈", "🎁", "✨", "⭐",
  "☀️", "🌈", "🌸", "🌻", "🌊", "🏖️", "✈️", "🎄", "👶", "💍", "🐶", "🐱",
];

export const borderHex = (id: BorderColor) => BORDER_COLORS.find((c) => c.id === id)?.hex ?? "#ffffff";

/** Cor da legenda: escura na moldura clara, branca na escura. */
export const captionInk = (frame: BorderColor | null | undefined) =>
  BORDER_COLORS.find((c) => c.id === frame)?.dark ? "#ffffff" : CAPTION_COLOR;

/** Letras como o cliente vê: um emoji conta como um, mesmo ocupando vários caracteres no texto. */
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== "function") return Array.from(text);
  return Array.from(new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(text), (s) => s.segment);
}

export const captionLength = (text: string) => graphemes(text).length;

/** Corta no limite sem partir um emoji ao meio. */
export const clipCaption = (text: string) => graphemes(text).slice(0, CAPTION_MAX).join("");

/** Há alguma mudança de cor ou tom para aplicar nos pixels? */
export function hasToneChange(a: Adjust | null): boolean {
  return Boolean(a && (a.auto || a.bw || a.brightness || a.contrast || a.saturation));
}

/** Nada a aplicar: pode ser gravado como null. */
export const isNeutralAdjust = (a: Adjust) => !hasToneChange(a) && !a.border && !a.caption && !a.frame;

/** Descarta o que não vale para o tipo de papel: borda na Polaroid, legenda e moldura fora dela. */
export function normalizeAdjust(adjust: Adjust, product: Pick<Product, "kind">): Adjust {
  const polaroid = product.kind === "polaroid";
  const text = clipCaption(adjust.caption?.text.replace(/\s+/g, " ").trim() ?? "").trim();
  return {
    ...adjust,
    border: polaroid ? null : adjust.border,
    caption: polaroid && adjust.caption && text ? { ...adjust.caption, text } : null,
    // Branca é a moldura de sempre: grava como nenhuma
    frame: polaroid && adjust.frame && adjust.frame !== "branco" ? adjust.frame : null,
  };
}

/** Resumo dos ajustes para a equipe da loja. */
export function describeAdjust(a: Adjust | null): string[] {
  if (!a) return [];
  const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  const out: string[] = [];
  if (a.auto) out.push("ajuste automático");
  if (a.bw) out.push("preto e branco");
  if (a.brightness) out.push(`luz ${signed(a.brightness)}`);
  if (a.contrast) out.push(`contraste ${signed(a.contrast)}`);
  if (a.saturation && !a.bw) out.push(`saturação ${signed(a.saturation)}`);
  if (a.border) {
    const color = BORDER_COLORS.find((c) => c.id === a.border!.color)?.label.toLowerCase();
    out.push(`borda ${color} de ${a.border.mm} mm`);
  }
  if (a.frame) out.push(`moldura ${BORDER_COLORS.find((c) => c.id === a.frame)?.label.toLowerCase()}`);
  if (a.caption) out.push(`legenda “${a.caption.text}” (${CAPTION_FONT_LABEL[a.caption.font].toLowerCase()})`);
  return out;
}
