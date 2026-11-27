/**
 * Download de um pedido para o computador da loja, no navegador do painel (Chrome ou Edge):
 * <nº do pedido>/<tamanho>/<arquivo>.jpg, uma cópia por arquivo.
 * Usado pela página do pedido e pela lista de pedidos (um ou vários de uma vez).
 */
import { sizeName } from "./catalog-data";
import { loadImage, type DecodedImage } from "./decode-image";
import { MINI_SHEET, renderMiniSheetFile, renderPrintFileFromUrl } from "./photo-render";
import type { Order, Photo, Product } from "./types";
import { ZipBuilder } from "./zip";

export type AdminPhoto = Photo & {
  thumb_url: string | null;
  /** null quando as imagens já foram apagadas do bucket. */
  original_url: string | null;
  /** Nome do arquivo sem extensão: o nome com que o cliente enviou, ou pedido_tamanho_índice se não der. */
  base_name: string;
};

export type OrderDownload = { order: Order; photos: AdminPhoto[]; products: Product[] };

/** API de acesso a pastas (Chrome e Edge no computador). Fora do lib.dom do TypeScript. */
export type DirectoryHandle = {
  name: string;
  requestPermission(options: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{ createWritable(): Promise<{ write(data: Blob | Uint8Array): Promise<void>; close(): Promise<void> }> }>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<DirectoryHandle>;
};

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * Nome com que o cliente enviou a foto, sem extensão e sem o que o Windows não aceita num nome de arquivo.
 * null quando não sobra nada aproveitável.
 */
export function fileStem(fileName: string) {
  const stem = fileName
    .normalize("NFC")
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  const cut = Array.from(stem).slice(0, 120).join("").trim();
  return !cut || RESERVED.test(cut) ? null : cut;
}

export const hasFolderPicker = () => typeof window !== "undefined" && Boolean((window as PickerWindow).showDirectoryPicker);

/** Teto de cada .zip. Acima disso o pedido sai em partes, para não pesar na memória do navegador. */
const ZIP_PART_BYTES = 1024 ** 3;
const ZIP_PART_FILES = 60_000;

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

/**
 * "Pasta" que vira download .zip: alternativa ao seletor de pasta, que o Chrome às vezes cancela sozinho.
 * Tem a mesma forma do DirectoryHandle, então writeOrder grava nela sem saber a diferença.
 * Cada pedido sai num .zip (pedido-1234.zip), ou em partes (pedido-1234-parte-1.zip...) se for grande.
 */
export class ZipFolder implements DirectoryHandle {
  name = "zip";
  private zip = new ZipBuilder();
  private label = "pedido";
  private part = 0;

  constructor(private prefix = "", private root?: ZipFolder) {}

  private get top(): ZipFolder {
    return this.root ?? this;
  }

  async requestPermission() {
    return "granted" as const;
  }

  async getDirectoryHandle(name: string) {
    return new ZipFolder(`${this.prefix}${name}/`, this.top);
  }

  async getFileHandle(name: string) {
    const path = `${this.prefix}${name}`;
    const top = this.top;
    let body: Blob | null = null;
    return {
      createWritable: async () => ({
        write: async (data: Blob | Uint8Array) => {
          body = data instanceof Blob ? data : new Blob([data as BlobPart]);
        },
        close: async () => {
          if (body) await top.add(path, body);
        },
      }),
    };
  }

  /** Começa um .zip novo com este nome base. */
  start(label: string) {
    this.label = label;
    this.part = 0;
    this.zip = new ZipBuilder();
  }

  private async add(path: string, blob: Blob) {
    if (this.zip.count && (this.zip.size + blob.size > ZIP_PART_BYTES || this.zip.count >= ZIP_PART_FILES)) {
      this.part += 1;
      this.flush();
    }
    await this.zip.add(path, blob);
  }

  private flush() {
    const name = this.part ? `${this.label}-parte-${this.part}.zip` : `${this.label}.zip`;
    saveFile(this.zip.finish(), name);
    this.zip = new ZipBuilder();
  }

  /** Baixa o que falta. Se o pedido já saiu em partes, esta é a última. */
  end() {
    if (!this.zip.count) return;
    if (this.part) this.part += 1;
    this.flush();
  }
}

type PickStep = "escolher pasta" | "escolher pasta (outro jeito)";

/**
 * Abre o seletor de pasta. null quando nenhuma pasta foi liberada. O Chrome dá o mesmo AbortError para janela
 * fechada, pasta recusada e permissão negada, então cada falha vai para o registro de erros com o tempo até o
 * erro e se a janela chegou a abrir (ela tira o foco da página).
 *
 * `simple`: só leitura, sem pasta inicial nem pasta lembrada. A permissão de gravar é pedida depois, em outro
 * clique (askWrite). Caminho alternativo para Chrome que cancela o pedido de gravação junto com o seletor.
 */
export async function pickFolder({ simple = false } = {}): Promise<DirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  const etapa: PickStep = simple ? "escolher pasta (outro jeito)" : "escolher pasta";
  const started = performance.now();
  let lostFocus = false;
  const onBlur = () => {
    lostFocus = true;
  };
  window.addEventListener("blur", onBlur);
  try {
    const root = await (simple
      ? picker({ mode: "read" })
      : picker({ id: "fotoville-pedidos", mode: "readwrite", startIn: "desktop" }));
    if (simple) reportDownloadError("pasta escolhida", { etapa, ms: Math.round(performance.now() - started) }, "warning");
    return root;
  } catch (err) {
    const cancelled = err instanceof DOMException && err.name === "AbortError";
    reportDownloadError(
      err,
      { etapa, ms: Math.round(performance.now() - started), janela_abriu: lostFocus },
      cancelled ? "warning" : "error",
    );
    return null;
  } finally {
    window.removeEventListener("blur", onBlur);
  }
}

/** Pede permissão para gravar na pasta escolhida pelo caminho alternativo. Precisa vir de um clique. */
export async function askWrite(root: DirectoryHandle): Promise<boolean> {
  try {
    const state = await root.requestPermission({ mode: "readwrite" });
    if (state !== "granted") {
      reportDownloadError(`permissão de gravar: ${state}`, { etapa: "permissão de gravar" }, "warning");
    }
    return state === "granted";
  } catch (err) {
    reportDownloadError(err, { etapa: "permissão de gravar" });
    return false;
  }
}

const MINI = "mini-polaroid";
const MINI_SHEET_FOLDER = "Mini Polaroid (folhas 10x15)";

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

  // Última folha em que cada foto aparece: depois dela, a foto decodificada sai da memória. Guardar todas
  // até o fim derrubava a aba com uma centena de Minis.
  const groups: AdminPhoto[][] = [];
  for (let i = 0; i < minis.length; i += MINI_SHEET.perSheet) groups.push(minis.slice(i, i + MINI_SHEET.perSheet));
  const lastSheet = new Map<string, number>();
  groups.forEach((group, sheet) => group.forEach((photo) => lastSheet.set(photo.original_url!, sheet)));

  groups.forEach((group, sheet) => {
    jobs.push({
      folder: MINI_SHEET_FOLDER,
      name: `${order.number}_${MINI}_folha_${String(sheet + 1).padStart(3, "0")}`,
      copies: 1,
      photoIds: group.map((p) => p.id),
      make: async () => {
        try {
          const items = await Promise.all(
            group.map(async (photo) => ({ source: await cached(photo.original_url!), photo, product: productOf(photo)! })),
          );
          return await renderMiniSheetFile(items);
        } finally {
          for (const url of new Set(group.map((p) => p.original_url!))) {
            if (lastSheet.get(url) !== sheet) continue;
            const image = cache.get(url);
            cache.delete(url);
            image?.then((img) => img.close()).catch(() => {});
          }
        }
      },
    });
  });
  /** Libera as fotos decodificadas para as folhas. */
  const release = () => cache.forEach((p) => p.then((img) => img.close()).catch(() => {}));
  return { jobs, release };
}

/** Quantos arquivos o download grava (cópias contadas, Minis em folhas). */
export const countFiles = (data: OrderDownload) => planJobs(data).jobs.reduce((sum, j) => sum + j.copies, 0);

export type WriteResult = { failed: number; cancelled: boolean };

/**
 * Grava o pedido dentro de `root`: pasta com o número e subpastas por tamanho.
 * `onProgress` recebe quantos arquivos já foram gravados. `signal` cancela entre um arquivo e outro:
 * o que já foi gravado fica na pasta.
 */
export async function writeOrder(
  root: DirectoryHandle,
  data: OrderDownload,
  options: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<WriteResult> {
  const { jobs, release } = planJobs(data);
  const total = jobs.reduce((sum, j) => sum + j.copies, 0);
  let failed = 0;
  let done = 0;

  const write = async (dir: DirectoryHandle, name: string, body: Blob | Uint8Array) => {
    const file = await dir.getFileHandle(name, { create: true });
    const stream = await file.createWritable();
    await stream.write(body);
    await stream.close();
  };

  // Duas fotos com o mesmo nome no mesmo tamanho: a segunda ganha " (2)", senão uma grava por cima da outra
  const used = new Set<string>();
  const unique = (folder: string, stem: string) => {
    let name = stem;
    for (let n = 2; used.has(`${folder}/${name.toLowerCase()}`); n++) name = `${stem} (${n})`;
    used.add(`${folder}/${name.toLowerCase()}`);
    return `${name}.jpg`;
  };

  const zip = root instanceof ZipFolder ? root : null;
  zip?.start(`pedido-${data.order.number}`);
  try {
    const orderDir = await root.getDirectoryHandle(String(data.order.number), { create: true });
    for (const job of jobs) {
      if (options.signal?.aborted) break;
      try {
        const blob = await job.make();
        const dir = await orderDir.getDirectoryHandle(job.folder, { create: true });
        for (let copy = 1; copy <= job.copies; copy++) {
          if (options.signal?.aborted) break;
          await write(dir, unique(job.folder, job.copies > 1 ? `${job.name}_${copy}` : job.name), blob);
          done += 1;
          options.onProgress?.(done, total);
        }
      } catch (err) {
        failed += 1;
        reportDownloadError(err, { etapa: "gravar foto", order: data.order.id, photos: job.photoIds, file: job.name });
      }
    }
    // Cancelado: o que já entrou no .zip é baixado, como na pasta, onde o já gravado fica
    zip?.end();
  } finally {
    release();
  }
  return { failed, cancelled: Boolean(options.signal?.aborted) };
}

async function reportDownloadError(err: unknown, detail: Record<string, unknown>, level: "error" | "warning" = "error") {
  const { reportError } = await import("./report-error");
  reportError("loja", err, detail, level);
}

/** Busca os dados do pedido para o download (lista de pedidos). */
export async function fetchOrderDownload(orderId: string, signal?: AbortSignal): Promise<OrderDownload> {
  const res = await fetch(`/api/admin/pedidos/${orderId}/fotos`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Depois de gravar o pedido: marca as fotos como baixadas e, se estava pago, passa para "Em produção". */
export async function markDownloaded(order: Pick<Order, "id" | "status">) {
  const ok = await patchOrder(order.id, {
    label_ready: true,
    ...(order.status === "paid" ? { status: "in_production" as const } : {}),
  });
  if (!ok) {
    reportDownloadError(new Error("Fotos gravadas, mas o pedido não foi marcado como baixado"), {
      etapa: "marcar baixado",
      order: order.id,
    });
  }
  return ok;
}

/** Muda a situação do pedido pela mesma rota da página do pedido. */
export async function patchOrder(
  orderId: string,
  patch: { status?: Order["status"]; tracking_code?: string; label_ready?: true },
) {
  const res = await fetch(`/api/admin/pedidos/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => null);
  return Boolean(res?.ok);
}
