/**
 * Desenho da foto pronta para impressão, no navegador. O mesmo código gera as prévias do cliente
 * e o arquivo que a loja baixa, então o que aparece na tela é o que vai para o papel.
 * Lê pixels de imagens do bucket: exige CORS de leitura (GET) liberado para o domínio do site.
 */
import { CAPTION_COLOR, hasToneChange } from "./adjust";
import { captionFont } from "./caption-fonts";
import { loadImage, type DecodedImage } from "./decode-image";
import { fitCrop, isLandscape, paperLayout, type Rect } from "./crop";
import type { Adjust, AutoTone, Photo, Product } from "./types";

type PhotoShape = Pick<Photo, "width_px" | "height_px" | "crop" | "fit" | "adjust">;
type Size = Pick<Product, "width_cm" | "height_cm" | "kind">;
export type RenderSource = { image: CanvasImageSource; width: number; height: number };

const LR = 0.299;
const LG = 0.587;
const LB = 0.114;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round3 = (v: number) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------
// Cor e tom
// ---------------------------------------------------------------------------

/** Curva de tom (0..1 para 0..1), a mesma nos três canais. Nenhuma etapa estoura preto ou branco. */
function toneCurve(a: Adjust) {
  const auto = a.auto;
  const brightness = Math.pow(2, -a.brightness / 100);
  const contrast = a.contrast >= 0 ? 1 + a.contrast / 100 : 1 + a.contrast / 200;
  return (x: number) => {
    if (auto) {
      x = clamp01((x - auto.black) / (auto.white - auto.black));
      x = Math.pow(x, auto.gamma);
      // Clareia sombras sem mexer nos claros nem no preto profundo, onde mora o ruído:
      // o termo some nas duas pontas e chega ao máximo perto de 1/3.
      if (auto.shadows) x += auto.shadows * 14 * x * x * (1 - x) ** 4;
    }
    if (brightness !== 1) x = Math.pow(clamp01(x), brightness);
    // Curva em S em volta do meio-tom; abaixo de zero, achata.
    if (contrast !== 1) x = x < 0.5 ? 0.5 * Math.pow(2 * x, contrast) : 1 - 0.5 * Math.pow(2 * (1 - x), contrast);
    return clamp01(x);
  };
}

/** Aplica os ajustes de cor e tom nos pixels RGBA, no lugar. */
export function applyTone(data: Uint8ClampedArray, a: Adjust) {
  const curve = toneCurve(a);
  const [lr, lg, lb] = (a.auto?.gains ?? [1, 1, 1]).map((gain) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = curve(clamp01((v / 255) * gain)) * 255;
    return lut;
  });
  const vibrance = a.bw ? 0 : (a.auto?.vibrance ?? 0);
  const saturation = a.bw ? 0 : 1 + a.saturation / 100;
  const mix = vibrance > 0 || saturation !== 1;

  for (let i = 0; i < data.length; i += 4) {
    let r = lr[data[i]];
    let g = lg[data[i + 1]];
    let b = lb[data[i + 2]];
    if (mix) {
      const l = LR * r + LG * g + LB * b;
      let f = saturation;
      // Vibração: reforça mais as cores apagadas do que as já intensas.
      if (vibrance) f *= 1 + vibrance * (1 - (Math.max(r, g, b) - Math.min(r, g, b)) / 255);
      r = l + (r - l) * f;
      g = l + (g - l) * f;
      b = l + (b - l) * f;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * Ajuste automático: lê o histograma e corrige o que costuma estragar foto de celular.
 * Puxa a cor para o neutro, estica preto e branco, acerta a exposição dos meios-tons,
 * clareia sombras fechadas e reforça cores apagadas. Cada correção tem limite, para
 * não desfazer o clima de propósito da foto (pôr do sol, noite, foto clara).
 */
export function analyzeTone(data: Uint8ClampedArray): AutoTone {
  const step = Math.max(1, Math.floor(data.length / 4 / 200_000)) * 4;

  // 1. Balanço de branco pelos pixels quase neutros (cinzas, brancos, paredes)
  let total = 0;
  let neutral = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let satSum = 0;
  let satCount = 0;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = LR * r + LG * g + LB * b;
    total++;
    if (mx > 24) {
      satSum += (mx - mn) / mx;
      satCount++;
    }
    if (l > 50 && l < 235 && mx - mn < 0.2 * mx) {
      sr += r;
      sg += g;
      sb += b;
      neutral++;
    }
  }
  const meanSat = satCount ? satSum / satCount : 0;
  const mono = meanSat < 0.04;
  let gains: [number, number, number] = [1, 1, 1];
  if (!mono && neutral > total * 0.05) {
    const avg = (sr + sg + sb) / 3;
    const raw = [sr, sg, sb].map((s) => 1 + Math.max(-0.18, Math.min(0.18, (avg / s - 1) * 0.75)));
    const top = Math.max(...raw); // nenhum ganho acima de 1: não estoura os claros
    gains = [raw[0] / top, raw[1] / top, raw[2] / top];
  }

  // 2. Histograma de luminância já com o balanço
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    const l = LR * data[i] * gains[0] + LG * data[i + 1] * gains[1] + LB * data[i + 2] * gains[2];
    hist[Math.min(255, Math.round(l))]++;
    count++;
  }
  const percentile = (q: number) => {
    const target = q * count;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v / 255;
    }
    return 1;
  };
  // Estica até o limite: foto lavada ou subexposta ganha preto e branco de verdade.
  const black = Math.min(percentile(0.005), 0.22);
  const white = Math.max(percentile(0.995), 0.4);

  // Céu, sol ou janela ocupando boa parte da foto: o escuro é a luz da cena (pôr do sol,
  // contraluz), não falta de exposição. Nesses casos a correção fica contida.
  let bright = 0;
  for (let v = 0; v < 256; v++) if ((v / 255 - black) / (white - black) > 0.8) bright += hist[v];
  const highlights = bright / count > 0.08;

  // 3. Exposição: leva a mediana para perto de 0,46, com 75% da correção
  const median = clamp01((percentile(0.5) - black) / (white - black));
  let gamma = 1;
  if (median > 0.02 && median < 0.98) {
    const ideal = Math.log(0.46) / Math.log(median);
    gamma = Math.min(1.15, Math.max(highlights ? 0.85 : 0.55, Math.pow(ideal, 0.75)));
  }

  // 4. Sombras: quanto da foto continua escura depois da exposição
  let dark = 0;
  for (let v = 0; v < 256; v++) {
    if (Math.pow(clamp01((v / 255 - black) / (white - black)), gamma) < 0.18) dark += hist[v];
  }
  const shadows = Math.min(highlights ? 0.25 : 0.45, Math.max(0, (dark / count - 0.1) * 1.3));

  // 5. Cor: quanto mais apagada a foto, mais vibração
  const vibrance = mono ? 0 : Math.min(0.25, Math.max(0.05, 0.3 - meanSat * 0.5));

  return {
    gains: [round3(gains[0]), round3(gains[1]), round3(gains[2])],
    black: round3(black),
    white: round3(white),
    gamma: round3(gamma),
    shadows: round3(shadows),
    vibrance: round3(vibrance),
  };
}

/** Calcula o ajuste automático de uma imagem, lida em até 400 px. */
export function analyzeImage(source: RenderSource): AutoTone {
  const s = Math.min(1, 400 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * s));
  canvas.height = Math.max(1, Math.round(source.height * s));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  return analyzeTone(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

// ---------------------------------------------------------------------------
// Papel
// ---------------------------------------------------------------------------

/**
 * Desenha a impressão inteira no canvas, com `pxPerMm` pixels por milímetro de papel:
 * fundo (borda ou moldura), foto cortada ou inteira, ajustes de cor e legenda.
 */
export async function renderPrint(
  canvas: HTMLCanvasElement,
  source: RenderSource,
  photo: PhotoShape,
  product: Size,
  pxPerMm: number,
) {
  const layout = paperLayout(product, isLandscape(photo), photo.adjust);
  const mm = (v: number) => Math.round(v * pxPerMm);
  const caption = layout.caption && photo.adjust?.caption?.text ? photo.adjust.caption : null;

  // A fonte carrega antes de mexer no canvas, para a prévia não piscar sem legenda.
  const text = caption && layout.caption ? await layoutCaption(canvas.getContext("2d")!, caption, layout.caption, mm) : null;

  canvas.width = mm(layout.width);
  canvas.height = mm(layout.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const win = {
    x: mm(layout.window.x),
    y: mm(layout.window.y),
    w: mm(layout.window.x + layout.window.w) - mm(layout.window.x),
    h: mm(layout.window.y + layout.window.h) - mm(layout.window.y),
  };
  const k = source.width / photo.width_px;
  let src: [number, number, number, number];
  let dst: [number, number, number, number];
  if (photo.fit || !photo.crop) {
    const s = Math.min(win.w / source.width, win.h / source.height);
    const w = Math.max(1, Math.round(source.width * s));
    const h = Math.max(1, Math.round(source.height * s));
    src = [0, 0, source.width, source.height];
    dst = [win.x + Math.round((win.w - w) / 2), win.y + Math.round((win.h - h) / 2), w, h];
  } else {
    const c = fitCrop(photo.crop, layout.window.w / layout.window.h);
    src = [c.x * k, c.y * k, c.width * k, c.height * k];
    dst = [win.x, win.y, win.w, win.h];
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.image, ...src, ...dst);

  if (photo.adjust && hasToneChange(photo.adjust)) {
    const pixels = ctx.getImageData(...dst);
    applyTone(pixels.data, photo.adjust);
    ctx.putImageData(pixels, dst[0], dst[1]);
  }

  if (text) {
    ctx.fillStyle = CAPTION_COLOR;
    ctx.font = text.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const line of text.lines) ctx.fillText(line.text, line.x, line.y);
  }
}

/**
 * Legenda centrada na faixa de baixo da Polaroid. Texto longo que ficaria miúdo numa linha
 * quebra em duas, no espaço que deixa as linhas mais parecidas.
 */
async function layoutCaption(
  ctx: CanvasRenderingContext2D,
  caption: NonNullable<Adjust["caption"]>,
  box: Rect,
  mm: (v: number) => number,
) {
  const info = captionFont(caption.font);
  const base = mm(box.h * 0.36 * info.scale);
  await document.fonts.load(info.canvasFont(base), caption.text).catch(() => []);
  ctx.font = info.canvasFont(base);
  const maxWidth = mm(box.w * 0.92);
  const widthAt = (t: string) => ctx.measureText(t).width;

  let lines = [caption.text];
  const one = Math.min(base, (base * maxWidth) / widthAt(caption.text));
  let px = one;
  const words = caption.text.split(" ");
  if (one < base * 0.7 && words.length > 1) {
    let best = { a: "", b: "", w: Infinity };
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const w = Math.max(widthAt(a), widthAt(b));
      if (w < best.w) best = { a, b, w };
    }
    const two = Math.min(base * 0.72, (base * maxWidth) / best.w);
    if (two > one) {
      lines = [best.a, best.b];
      px = two;
    }
  }

  px = Math.max(1, Math.floor(px));
  ctx.font = info.canvasFont(px);
  // Centraliza pela altura de "Hg", para a linha não pular conforme as letras digitadas.
  const ref = ctx.measureText("Hg");
  const shift = (ref.actualBoundingBoxAscent - ref.actualBoundingBoxDescent) / 2;
  const gap = px * 1.15;
  const cx = mm(box.x + box.w / 2);
  const cy = mm(box.y + box.h / 2) + shift;
  return {
    font: info.canvasFont(px),
    lines: lines.map((t, i) => ({ text: t, x: cx, y: cy + (i - (lines.length - 1) / 2) * gap })),
  };
}

/** Maior lado de canvas que o Chrome e o Edge desenham com segurança. */
const MAX_CANVAS_SIDE = 16384;

/**
 * Resolução do arquivo de impressão, em dpi inteiro: a nativa da foto no papel (nenhum pixel
 * do cliente se perde), nunca abaixo de 300 (borda e legenda nítidas mesmo com foto pequena)
 * e no máximo o que o canvas do navegador aguenta.
 */
export function printFileDpi(source: { width: number; height: number }, photo: PhotoShape, product: Size) {
  const layout = paperLayout(product, isLandscape(photo), photo.adjust);
  const k = source.width / photo.width_px;
  const native =
    photo.fit || !photo.crop
      ? Math.max(source.width / layout.window.w, source.height / layout.window.h)
      : (photo.crop.width * k) / layout.window.w;
  const dpi = Math.max(300, Math.ceil(native * 25.4));
  const limit = Math.floor((MAX_CANVAS_SIDE * 25.4) / Math.max(layout.width, layout.height));
  return Math.min(dpi, limit);
}

/**
 * Grava a densidade (dpi) no cabeçalho JFIF do JPEG, para o arquivo abrir no software da
 * impressora exatamente no tamanho do papel. O canvas gera o JPEG sem essa informação.
 */
export async function withJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
  const density = [1, dpi >> 8, dpi & 0xff, dpi >> 8, dpi & 0xff]; // unidade 1 = pontos por polegada
  const isJfif =
    bytes[2] === 0xff && bytes[3] === 0xe0 && String.fromCharCode(...bytes.subarray(6, 11)) === "JFIF\0";
  if (isJfif) {
    bytes.set(density, 13);
    return new Blob([bytes], { type: "image/jpeg" });
  }
  // Sem APP0: insere um JFIF 1.01 logo depois do SOI, como manda a especificação.
  const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, ...density, 0, 0]);
  return new Blob([bytes.subarray(0, 2), app0, bytes.subarray(2)], { type: "image/jpeg" });
}

/** JPEG do canvas, com o dpi gravado. Zera o canvas em seguida para liberar a memória. */
async function canvasToPrintJpeg(canvas: HTMLCanvasElement, dpi: number) {
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/jpeg", 0.95),
  );
  canvas.width = canvas.height = 0;
  return withJpegDpi(jpeg, dpi);
}

/**
 * Arquivo final para a loja, em JPEG, na medida real do papel e com o dpi gravado no cabeçalho.
 * Resolução: a da foto do cliente (ver printFileDpi).
 */
export async function renderPrintFile(source: DecodedImage, photo: PhotoShape, product: Size): Promise<Blob> {
  const dpi = printFileDpi(source, photo, product);
  const canvas = document.createElement("canvas");
  await renderPrint(canvas, source, photo, product, dpi / 25.4);
  return canvasToPrintJpeg(canvas, dpi);
}

/** Baixa a foto do bucket e gera o arquivo de impressão. */
export async function renderPrintFileFromUrl(url: string, photo: PhotoShape, product: Size): Promise<Blob> {
  const source = await loadImage(url);
  try {
    return await renderPrintFile(source, photo, product);
  } finally {
    source.close();
  }
}

/**
 * Folha de Mini Polaroid: papel 10x15 deitado (15,2 x 10,2 cm) com até duas Minis lado a lado sobre
 * fundo escuro. A loja imprime a folha como um 10x15 e corta; o fundo escuro marca a borda branca.
 */
export const MINI_SHEET = { width: 152, height: 102, gap: 8, perSheet: 2, background: "#202020" };

export type SheetItem = { source: DecodedImage; photo: PhotoShape; product: Size };

export async function renderMiniSheetFile(items: SheetItem[]): Promise<Blob> {
  const sheetLimit = Math.floor((MAX_CANVAS_SIDE * 25.4) / MINI_SHEET.width);
  const dpi = Math.min(sheetLimit, Math.max(...items.map((it) => printFileDpi(it.source, it.photo, it.product))));
  const pxPerMm = dpi / 25.4;
  const mm = (v: number) => Math.round(v * pxPerMm);

  const sheet = document.createElement("canvas");
  sheet.width = mm(MINI_SHEET.width);
  sheet.height = mm(MINI_SHEET.height);
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = MINI_SHEET.background;
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  // Minis centradas na folha, sempre em pé (paperLayout da Polaroid), com um vão entre elas.
  const layouts = items.map((it) => paperLayout(it.product, isLandscape(it.photo), it.photo.adjust));
  const total = layouts.reduce((w, l) => w + l.width, 0) + MINI_SHEET.gap * (items.length - 1);
  let x = (MINI_SHEET.width - total) / 2;
  for (const [i, it] of items.entries()) {
    const one = document.createElement("canvas");
    await renderPrint(one, it.source, it.photo, it.product, pxPerMm);
    ctx.drawImage(one, mm(x), mm((MINI_SHEET.height - layouts[i].height) / 2));
    one.width = one.height = 0;
    x += layouts[i].width + MINI_SHEET.gap;
  }
  return canvasToPrintJpeg(sheet, dpi);
}
