/** Decodificação de imagens no navegador, à prova das limitações do Chrome no Android. */

export type DecodedImage = {
  image: CanvasImageSource;
  /** Dimensões já na orientação certa (EXIF). */
  width: number;
  height: number;
  /** Libera a memória da imagem. */
  close: () => void;
};

/**
 * Decodifica a imagem já na orientação certa (EXIF).
 * O createImageBitmap é o caminho rápido, mas no Chrome do Android ele recusa fotos de resolução muito alta
 * (50 MP ou mais) com "The source image could not be decoded". O <img> abre a mesma foto reduzindo a
 * resolução na decodificação, e as dimensões continuam sendo as do original.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(await unreadableReason(blob));
    }
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }
}

/** Baixa e decodifica uma imagem por URL (do bucket ou local). */
export async function loadImage(url: string, signal?: AbortSignal): Promise<DecodedImage> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return decodeImage(await res.blob());
}

/** Explica por que a foto não abriu. HEIC com extensão .jpg é o caso mais comum no Android. */
async function unreadableReason(blob: Blob) {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const brand = String.fromCharCode(...head.slice(4, 12));
  if (/^ftyp(hei|hev|mif1|msf1|avif)/.test(brand)) return "Foto em formato HEIC. Envie em JPG.";
  if (!blob.size) return "Arquivo vazio. Se a foto estiver só na nuvem, baixe para o aparelho e envie de novo.";
  return "Não foi possível abrir esta foto.";
}
