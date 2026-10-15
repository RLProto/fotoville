/**
 * Download de um pedido para o computador da loja, no navegador do painel (Chrome ou Edge):
 * <nº do pedido>/<tamanho>/<arquivo>.jpg, uma cópia por arquivo, mais o PDF das etiquetas.
 * Usado pela página do pedido e pela lista de pedidos (um ou vários de uma vez).
 */
import { formatCep, formatPhone } from "./format";
import { loadImage, type DecodedImage } from "./decode-image";
import { buildLabelsPdf, type LabelData } from "./order-label";
import { MINI_SHEET, renderMiniSheetFile, renderPrintFileFromUrl } from "./photo-render";
import type { Order, Photo, Product } from "./types";

export type AdminPhoto = Photo & {
  thumb_url: string | null;
  /** null quando as imagens já foram apagadas do bucket. */
  original_url: string | null;
  /** Nome base do arquivo: pedido_tamanho_índice */
  base_name: string;
};

export type OrderDownload = { order: Order; photos: AdminPhoto[]; products: Product[] };

/** API de acesso a pastas (Chrome e Edge no computador). Fora do lib.dom do TypeScript. */
export type DirectoryHandle = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{ createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }> }>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<DirectoryHandle>;
};

export const hasFolderPicker = () => typeof window !== "undefined" && Boolean((window as PickerWindow).showDirectoryPicker);

/** Abre o seletor de pasta. null quando a janela é fechada sem escolher. */
export async function pickFolder(): Promise<DirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker({ id: "fotoville-pedidos", mode: "readwrite", startIn: "desktop" });
  } catch {
    return null;
  }
}

const MINI = "mini-polaroid";
const MINI_SHEET_FOLDER = "Mini Polaroid (folhas 10x15)";

/** Nome comercial do tamanho, como o cliente vê: "10x15", "Polaroid". */
export const sizeName = (product: Pick<Product, "name">) => product.name.replace(/ cm$/, "");

/** Pasta de cada tamanho dentro da pasta do pedido. */
function sizeFolder(product: Product) {
  return product.id === MINI ? MINI_SHEET_FOLDER : sizeName(product);
}

/** Um arquivo a gravar na pasta do pedido. `copies` grava o mesmo arquivo mais de uma vez. */
type Job = { folder: string; name: string; copies: number; photoIds: string[]; make: () => Promise<Blob> };

/**
 * Arquivos do pedido: um por foto (gravado tantas vezes quantas cópias), menos a Mini Polaroid,
 * que sai em folhas 10x15 com duas Minis cada, já contando as cópias.
 */
export function planJobs({ order, photos, products }: OrderDownload) {
  const productOf = (p: AdminPhoto) => products.find((x) => x.id === p.product_id);
  const jobs: Job[] = [];
  const minis: AdminPhoto[] = [];
  const cache = new Map<string, Promise<DecodedImage>>();
  const cached = (url: string) => cache.get(url) ?? cache.set(url, loadImage(url)).get(url)!;

  for (const photo of photos) {
    const product = productOf(photo);
    if (!product) throw new Error(`Tamanho ${photo.product_id} não encontrado.`);
    const url = photo.original_url;
    if (!url) throw new Error("Imagens já apagadas do servidor.");
    if (product.id === MINI) {
      for (let i = 0; i < photo.quantity; i++) minis.push(photo);
      continue;
    }
    jobs.push({
      folder: sizeFolder(product),
      name: photo.base_name,
      copies: photo.quantity,
      photoIds: [photo.id],
      // Arquivo pronto para impressão: corte, borda ou moldura, cor e legenda, como o cliente viu.
      make: () => renderPrintFileFromUrl(url, photo, product),
    });
  }

  for (let i = 0; i < minis.length; i += MINI_SHEET.perSheet) {
    const group = minis.slice(i, i + MINI_SHEET.perSheet);
    jobs.push({
      folder: MINI_SHEET_FOLDER,
      name: `${order.number}_${MINI}_folha_${String(i / MINI_SHEET.perSheet + 1).padStart(3, "0")}`,
      copies: 1,
      photoIds: group.map((p) => p.id),
      make: async () => {
        const items = await Promise.all(
          group.map(async (photo) => ({ source: await cached(photo.original_url!), photo, product: productOf(photo)! })),
        );
        return renderMiniSheetFile(items);
      },
    });
  }
  /** Libera as fotos decodificadas para as folhas. */
  const release = () => cache.forEach((p) => p.then((img) => img.close()).catch(() => {}));
  return { jobs, release };
}

/** Quantos arquivos o download grava (cópias contadas, Minis em folhas). */
export const countFiles = (data: OrderDownload) => planJobs(data).jobs.reduce((sum, j) => sum + j.copies, 0);

/** Uma etiqueta por tamanho do pedido, na ordem do catálogo. */
export function labelsFor({ order, photos, products }: OrderDownload): LabelData[] {
  const customer = order.customer;
  const address = order.shipping_address;
  const lines =
    order.shipping_service === "retirada" || !address
      ? ["RETIRADA NA LOJA"]
      : [
          `${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ""}`,
          `${address.district}, ${address.city}/${address.state}`,
          `CEP ${formatCep(address.cep)}${order.shipping_service === "motoboy" ? "  -  MOTOBOY" : ""}`,
        ];
  if (customer?.whatsapp) lines.push(`WhatsApp ${formatPhone(customer.whatsapp)}`);

  const copies = new Map<string, number>();
  for (const photo of photos) copies.set(photo.product_id, (copies.get(photo.product_id) ?? 0) + photo.quantity);
  return products
    .filter((p) => copies.has(p.id))
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({
      number: order.number,
      customer: customer?.name || customer?.email || "Sem nome",
      lines,
      size: sizeName(p),
      copies: copies.get(p.id)!,
      url: `${window.location.origin}/admin/pedidos/${order.id}`,
    }));
}

export type WriteResult = { files: number; labels: number; failed: number };

/**
 * Grava o pedido dentro de `root`: pasta com o número, subpastas por tamanho e o PDF das etiquetas.
 * `onProgress` recebe quantos arquivos já foram gravados.
 */
export async function writeOrder(
  root: DirectoryHandle,
  data: OrderDownload,
  options: { onProgress?: (done: number, total: number) => void } = {},
): Promise<WriteResult> {
  const { jobs, release } = planJobs(data);
  const total = jobs.reduce((sum, j) => sum + j.copies, 0);
  const labels = labelsFor(data);
  let failed = 0;
  let done = 0;

  const write = async (dir: DirectoryHandle, name: string, body: Blob | Uint8Array) => {
    const file = await dir.getFileHandle(name, { create: true });
    const stream = await file.createWritable();
    await stream.write(body);
    await stream.close();
  };

  try {
    const orderDir = await root.getDirectoryHandle(String(data.order.number), { create: true });
    for (const job of jobs) {
      try {
        const blob = await job.make();
        const dir = await orderDir.getDirectoryHandle(job.folder, { create: true });
        for (let copy = 1; copy <= job.copies; copy++) {
          await write(dir, `${job.name}_${copy}.jpg`, blob);
          done += 1;
          options.onProgress?.(done, total);
        }
      } catch (err) {
        failed += 1;
        reportDownloadError(err, { etapa: "gravar foto", order: data.order.id, photos: job.photoIds, file: job.name });
      }
    }
    try {
      await write(orderDir, `etiquetas_${data.order.number}.pdf`, await buildLabelsPdf(labels));
    } catch (err) {
      failed += 1;
      reportDownloadError(err, { etapa: "gerar etiquetas", order: data.order.id });
    }
  } finally {
    release();
  }
  return { files: done, labels: labels.length, failed };
}

async function reportDownloadError(err: unknown, detail: Record<string, unknown>) {
  const { reportError } = await import("./report-error");
  reportError("loja", err, detail);
}

/** Busca os dados do pedido para o download (lista de pedidos). */
export async function fetchOrderDownload(orderId: string): Promise<OrderDownload> {
  const res = await fetch(`/api/admin/pedidos/${orderId}/fotos`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Muda a situação do pedido pela mesma rota da página do pedido. */
export async function patchOrder(orderId: string, patch: { status?: Order["status"]; tracking_code?: string }) {
  const res = await fetch(`/api/admin/pedidos/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => null);
  return Boolean(res?.ok);
}
