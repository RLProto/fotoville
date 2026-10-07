import { borderHex } from "./adjust";
import type { Adjust, Crop, Photo, Product } from "./types";

type PhotoShape = Pick<Photo, "width_px" | "height_px" | "crop" | "fit" | "adjust">;

/**
 * Moldura de cada formato instantâneo, em mm: margem dos lados, margem de cima e a proporção da janela
 * (altura/largura). A faixa de baixo, onde vai a legenda, fica com o resto do papel.
 * Medidas dos filmes originais: Polaroid 600/i-Type 88 x 107 com imagem 79 x 79;
 * Instax Mini 54 x 86 com imagem 46 x 62.
 */
export const INSTANT_FRAMES: Record<string, { side: number; top: number; ratio: number }> = {
  polaroid: { side: 4.5, top: 6, ratio: 1 },
  "polaroid-ima": { side: 4.5, top: 6, ratio: 1 },
  "mini-polaroid": { side: 4, top: 6, ratio: 62 / 46 },
};
const DEFAULT_FRAME = { side: 5, top: 5, ratio: 1 };

type Size = Pick<Product, "width_cm" | "height_cm" | "kind"> & { id?: string };

export type Rect = { x: number; y: number; w: number; h: number };

export type PaperLayout = {
  /** Papel em mm, já na orientação da impressão. */
  width: number;
  height: number;
  /** Onde a foto entra, em mm. */
  window: Rect;
  /** Faixa de baixo da Polaroid, onde vai a legenda. */
  caption: Rect | null;
  /** Cor do papel em volta da foto. */
  background: string;
};

/**
 * Geometria do papel. Polaroid e Mini Polaroid: sempre em pé, com a moldura do filme original (janela em cima,
 * faixa larga embaixo). Demais tamanhos: na orientação pedida, com a borda escolhida (ou nenhuma).
 */
export function paperLayout(product: Size, landscape: boolean, adjust: Adjust | null = null): PaperLayout {
  const long = Math.max(product.width_cm, product.height_cm) * 10;
  const short = Math.min(product.width_cm, product.height_cm) * 10;

  if (product.kind === "polaroid") {
    const frame = (product.id && INSTANT_FRAMES[product.id]) || DEFAULT_FRAME;
    const w = short - 2 * frame.side;
    // A janela segue a proporção do filme, sem engolir a faixa de baixo
    const h = Math.min(w * frame.ratio, long - frame.top - frame.side);
    return {
      width: short,
      height: long,
      window: { x: frame.side, y: frame.top, w, h },
      caption: { x: frame.side, y: frame.top + h, w, h: long - frame.top - h },
      background: "#ffffff",
    };
  }

  const width = landscape ? long : short;
  const height = landscape ? short : long;
  const b = adjust?.border?.mm ?? 0;
  return {
    width,
    height,
    window: { x: b, y: b, w: width - 2 * b, h: height - 2 * b },
    caption: null,
    background: adjust?.border ? borderHex(adjust.border.color) : "#ffffff",
  };
}

/** Proporção do corte (largura/altura): a da janela da foto no papel. */
export function cropAspect(product: Size, landscape: boolean, adjust: Adjust | null = null) {
  const { window } = paperLayout(product, landscape, adjust);
  return window.w / window.h;
}

/** Orientação da impressão: a do corte, ou a da própria foto quando ela vai inteira. */
export function isLandscape(photo: Pick<Photo, "width_px" | "height_px" | "crop" | "fit">) {
  return photo.fit || !photo.crop ? photo.width_px >= photo.height_px : photo.crop.width >= photo.crop.height;
}

/** Corte central que preenche a janela inteira, na orientação da própria foto. */
export function defaultCrop(widthPx: number, heightPx: number, product: Size): Crop {
  const aspect = cropAspect(product, widthPx >= heightPx);
  let width = widthPx;
  let height = Math.round(width / aspect);
  if (height > heightPx) {
    height = heightPx;
    width = Math.round(height * aspect);
  }
  return {
    x: Math.round((widthPx - width) / 2),
    y: Math.round((heightPx - height) / 2),
    width,
    height,
  };
}

/** Apara o corte pelo centro até a proporção pedida (a borda muda a proporção da janela). */
export function fitCrop(crop: Crop, aspect: number): Crop {
  const current = crop.width / crop.height;
  if (Math.abs(current - aspect) < 0.002) return crop;
  if (current > aspect) {
    const width = Math.max(1, Math.round(crop.height * aspect));
    return { ...crop, x: crop.x + Math.round((crop.width - width) / 2), width };
  }
  const height = Math.max(1, Math.round(crop.width / aspect));
  return { ...crop, y: crop.y + Math.round((crop.height - height) / 2), height };
}

/**
 * Resolução de impressão em DPI da foto dentro da janela. Abaixo de ~120 a foto sai
 * visivelmente sem nitidez; o ideal para papel fotográfico é 250-300.
 */
export function printDpi(photo: PhotoShape, product: Size) {
  const { window } = paperLayout(product, isLandscape(photo), photo.adjust);
  const area = photo.fit || !photo.crop ? { width: photo.width_px, height: photo.height_px } : photo.crop;
  const mmPerPx = photo.fit
    ? Math.min(window.w / area.width, window.h / area.height)
    : Math.max(window.w / area.width, window.h / area.height);
  return Math.round(25.4 / mmPerPx);
}

export const LOW_DPI = 120;
