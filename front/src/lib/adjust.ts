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

/** Cores da borda e as de acesso rápido da moldura da Polaroid. */
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

export const HEX_COLOR = /^#[0-9a-f]{6}$/;

function hslHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Paleta maior da moldura, no jeito da do Office: uma coluna por cor, do mais claro ao mais escuro.
 * A primeira coluna vai do branco ao preto.
 */
export const FRAME_PALETTE: { hex: string; label: string }[][] = (() => {
  const shades = ["muito claro", "claro", "médio claro", "médio", "escuro", "muito escuro"];
  const grays = ["#ffffff", "#d9d9d9", "#a6a6a6", "#7f7f7f", "#404040", "#000000"];
  const grayLabels = ["Branco", "Cinza muito claro", "Cinza claro", "Cinza", "Cinza escuro", "Preto"];
  const hues: [string, number, number][] = [
    ["Vermelho", 0, 75],
    ["Laranja", 25, 85],
    ["Amarelo", 48, 90],
    ["Verde", 120, 50],
    ["Verde-água", 170, 60],
    ["Azul", 210, 75],
    ["Anil", 235, 55],
    ["Roxo", 275, 55],
    ["Rosa", 330, 70],
  ];
  const light = [92, 82, 68, 52, 38, 24];
  return light.map((l, row) => [
    { hex: grays[row], label: grayLabels[row] },
    ...hues.map(([name, h, s]) => ({ hex: hslHex(h, s, l), label: `${name} ${shades[row]}` })),
  ]);
})();

/** Cor da moldura em hex: das cores da borda ou já em hex. */
export const frameHex = (frame: string | null | undefined) =>
  !frame ? "#ffffff" : HEX_COLOR.test(frame) ? frame : borderHex(frame as BorderColor);

/** Nome da cor da moldura para a equipe da loja. */
function frameLabel(frame: string) {
  if (!HEX_COLOR.test(frame)) return BORDER_COLORS.find((c) => c.id === frame)?.label.toLowerCase() ?? frame;
  const named = FRAME_PALETTE.flat().find((c) => c.hex === frame);
  return named ? named.label.toLowerCase() : frame.toUpperCase();
}

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

export const borderHex = (id: BorderColor) => BORDER_COLORS.find((c) => c.id === id)?.hex ?? "#ffffff";

/** Cor da legenda: escura na moldura clara, branca na escura (a que tiver mais contraste). */
export function captionInk(frame: string | null | undefined) {
  const hex = frameHex(frame);
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  // Contraste com o branco maior que com a tinta escura (luminância 0,019)
  return luminance < 0.22 ? "#ffffff" : CAPTION_COLOR;
}

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
    frame: polaroid ? normalizeFrame(adjust.frame) : null,
  };
}

/** Branca é a moldura de sempre: grava como nenhuma. */
function normalizeFrame(frame: string | null | undefined) {
  const value = frame?.toLowerCase();
  if (!value || value === "branco" || value === "#ffffff") return null;
  return HEX_COLOR.test(value) || BORDER_COLORS.some((c) => c.id === value) ? value : null;
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
  if (a.frame) out.push(`moldura ${frameLabel(a.frame)}`);
  if (a.caption) out.push(`legenda “${a.caption.text}” (${CAPTION_FONT_LABEL[a.caption.font].toLowerCase()})`);
  return out;
}
