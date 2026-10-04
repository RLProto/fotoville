import { borderHex } from "./adjust";
import type { Adjust, Crop, Photo, Product } from "./types";

type Size = Pick<Product, "width_cm" | "height_cm" | "kind">;
type PhotoShape = Pick<Photo, "width_px" | "height_px" | "crop" | "fit" | "adjust">;

/** Margem da Polaroid em mm: igual no topo e nas laterais. A faixa de baixo fica com o resto do papel. */
export const POLAROID_MARGIN_MM = 5;

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
 * Geometria do papel. Polaroid: sempre em pé, janela quadrada com margens iguais em cima e dos lados.
 * Demais tamanhos: na orientação pedida, com a borda escolhida (ou nenhuma).
 */
export function paperLayout(product: Size, landscape: boolean, adjust: Adjust | null = null): PaperLayout {
  const long = Math.max(product.width_cm, product.height_cm) * 10;
  const short = Math.min(product.width_cm, product.height_cm) * 10;

  if (product.kind === "polaroid") {
    const m = POLAROID_MARGIN_MM;
    const side = short - 2 * m;
    const h = Math.min(side, long - 2 * m);
    return {
      width: short,
      height: long,
      window: { x: m, y: m, w: side, h },
      caption: { x: m, y: m + h, w: side, h: long - m - h },
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
