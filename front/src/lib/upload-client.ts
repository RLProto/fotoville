/** Utilitários de upload que rodam no navegador. */
import { decodeImage } from "./decode-image";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
const THUMB_MAX_SIDE = 720;

/** Lê as dimensões (já com a rotação EXIF aplicada) e gera uma miniatura JPEG. */
export async function readImage(file: File): Promise<{ width: number; height: number; thumb: Blob }> {
  const decoded = await decodeImage(file);
  const { width, height } = decoded;
  const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível abrir esta foto. Tente outra.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
  decoded.close();

  const thumb = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível abrir esta foto. Tente outra."))), "image/jpeg", 0.82),
  );
  return { width, height, thumb };
}

/** PUT direto no bucket pela URL assinada, com progresso (fetch não informa progresso de envio). */
export function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("O envio falhou. Tente de novo."));
    xhr.onerror = () => reject(new Error("A conexão caiu durante o envio. Tente de novo."));
    xhr.send(body);
  });
}

/** Executa tarefas com limite de simultaneidade. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
    }),
  );
}
