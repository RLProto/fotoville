/// <reference lib="webworker" />
/** Decodifica uma foto HEIC fora da thread principal. */
import libheif from "libheif-js/libheif-wasm/libheif-bundle.mjs";
import { heicColorSpace } from "./heic-format";

export type HeicDecoded =
  | { width: number; height: number; pixels: ArrayBuffer; colorSpace: PredefinedColorSpace }
  | { error: string };

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const buffer = event.data;
    const heif = libheif();
    const decoder = new heif.HeifDecoder();
    const images = decoder.decode(buffer);
    try {
      if (!images.length) throw new Error("nenhuma imagem no arquivo");
      const image = images.find((img) => img.is_primary()) ?? images[0];
      // Já na orientação certa: a libheif aplica a rotação
      const width = image.get_width();
      const height = image.get_height();
      const data = new Uint8ClampedArray(width * height * 4);
      await new Promise<void>((resolve, reject) =>
        image.display({ data, width, height }, (out) => (out ? resolve() : reject(new Error("falha ao decodificar")))),
      );
      // Transparência vira fundo branco
      const alpha = image.has_alpha_channel();
      for (let i = 3; i < data.length; i += 4) {
        const a = data[i];
        if (a === 255) continue;
        if (alpha) {
          const rest = 255 - a;
          data[i - 3] = (data[i - 3] * a + 255 * rest) / 255;
          data[i - 2] = (data[i - 2] * a + 255 * rest) / 255;
          data[i - 1] = (data[i - 1] * a + 255 * rest) / 255;
        }
        data[i] = 255;
      }
      const result: HeicDecoded = { width, height, pixels: data.buffer, colorSpace: heicColorSpace(new Uint8Array(buffer)) };
      self.postMessage(result, [data.buffer]);
    } finally {
      for (const img of images) img.free();
      heif.heif_context_free(decoder.decoder);
    }
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) } satisfies HeicDecoded);
  }
};
