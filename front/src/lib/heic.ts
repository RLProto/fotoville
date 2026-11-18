/** Conversão de fotos HEIC (iPhone, alguns Android) em JPG no navegador, antes do envio. */
import { isHeicHeader, jpegName } from "./heic-format";
import type { HeicDecoded } from "./heic.worker";

/** Mesma qualidade do editor. */
const JPEG_QUALITY = 0.95;
const FAILED = "Não foi possível abrir esta foto HEIC.";

/** HEIC pelo tipo ou pela extensão. */
export function looksLikeHeic(file: File) {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export async function isHeic(file: Blob) {
  return isHeicHeader(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
}

let queue: Promise<unknown> = Promise.resolve();

/** Converte em JPG sRGB na resolução original. Uma por vez, pela memória. */
export function heicToJpeg(file: File): Promise<File> {
  const run = queue.then(() => convert(file));
  queue = run.catch(() => {});
  return run;
}

async function convert(file: File) {
  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL("./heic.worker.ts", import.meta.url), { type: "module" });
  let decoded: HeicDecoded;
  try {
    decoded = await new Promise<HeicDecoded>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<HeicDecoded>) => resolve(e.data);
      worker.onerror = (e) => reject(new Error(FAILED, { cause: e.message || "erro no worker" }));
      worker.postMessage(buffer, [buffer]);
    });
  } finally {
    // Só encerrando o worker o WebAssembly devolve a memória
    worker.terminate();
  }
  if ("error" in decoded) throw new Error(FAILED, { cause: decoded.error });

  const { width, height, pixels, colorSpace } = decoded;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(FAILED, { cause: "canvas indisponível" });
    // Canvas sRGB: pixels marcados como P3 são convertidos
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height, { colorSpace }), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error(FAILED, { cause: `toBlob vazio ${width}x${height}` });
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    canvas.width = canvas.height = 0;
  }
}
