import { Caveat, Great_Vibes, Pacifico, Playfair_Display, Special_Elite } from "next/font/google";
import { CAPTION_FONT_LABEL } from "./adjust";
import type { CaptionFont } from "./types";

// Fontes da legenda da Polaroid. Sem preload: só baixam quando alguém abre o editor ou vê uma legenda.
const caneta = Caveat({ subsets: ["latin"], weight: "500", preload: false });
const caligrafia = Great_Vibes({ subsets: ["latin"], weight: "400", preload: false });
const classica = Playfair_Display({ subsets: ["latin"], weight: "500", style: "italic", preload: false });
const maquina = Special_Elite({ subsets: ["latin"], weight: "400", preload: false });
const retro = Pacifico({ subsets: ["latin"], weight: "400", preload: false });

const FONTS = { caneta, caligrafia, classica, maquina, retro };

type CaptionFontInfo = {
  id: CaptionFont;
  label: string;
  className: string;
  /** Prefixo do `ctx.font` do canvas: estilo, peso e família. */
  canvasFont: (px: number) => string;
  /** Iguala o tamanho visual: Caligrafia é miúda no mesmo corpo, Máquina e Retrô são graúdas. */
  scale: number;
};

export const CAPTION_FONTS: CaptionFontInfo[] = (
  [
    ["caneta", 1.15],
    ["caligrafia", 1.2],
    ["classica", 0.95],
    ["maquina", 0.85],
    ["retro", 0.85],
  ] as const
).map(([id, scale]) => {
  const { fontFamily, fontStyle = "normal", fontWeight = 400 } = FONTS[id].style;
  return {
    id,
    label: CAPTION_FONT_LABEL[id],
    className: FONTS[id].className,
    canvasFont: (px: number) => `${fontStyle} ${fontWeight} ${px}px ${fontFamily}`,
    scale,
  };
});

export const captionFont = (id: CaptionFont) => CAPTION_FONTS.find((f) => f.id === id) ?? CAPTION_FONTS[0];
