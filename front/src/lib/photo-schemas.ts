import { z } from "zod";
import { BORDER_COLORS, BORDER_MM, CAPTION_FONT_LABEL, CAPTION_MAX } from "./adjust";
import type { BorderColor, CaptionFont } from "./types";

/** Validação do que o navegador manda para gravar numa foto do carrinho (uma por vez ou em lote). */

const slider = z.number().int().min(-100).max(100);
const gain = z.number().min(0.5).max(1);

export const quantitySchema = z.number().int().min(1).max(10000);

export const adjustSchema = z.object({
  auto: z
    .object({
      gains: z.tuple([gain, gain, gain]),
      black: z.number().min(0).max(0.5),
      white: z.number().min(0.3).max(1),
      gamma: z.number().min(0.3).max(3),
      shadows: z.number().min(0).max(1),
      vibrance: z.number().min(0).max(1),
    })
    .nullable(),
  brightness: slider,
  contrast: slider,
  saturation: slider,
  bw: z.boolean(),
  border: z
    .object({
      color: z.enum(BORDER_COLORS.map((c) => c.id) as [BorderColor, ...BorderColor[]]),
      mm: z.number().int().min(BORDER_MM.min).max(BORDER_MM.max),
    })
    .nullable(),
  caption: z
    .object({
      text: z.string().max(CAPTION_MAX * 2),
      font: z.enum(Object.keys(CAPTION_FONT_LABEL) as [CaptionFont, ...CaptionFont[]]),
    })
    .nullable(),
});
