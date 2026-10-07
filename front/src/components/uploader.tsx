"use client";

import {
  ArrowsOutCardinalIcon,
  CircleNotchIcon,
  CopyIcon,
  ImagesIcon,
  MagicWandIcon,
  MinusIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_ADJUST, isNeutralAdjust } from "@/lib/adjust";
import { LOW_DPI, printDpi } from "@/lib/crop";
import { formatBRL, plural } from "@/lib/format";
import { decodeImage, loadImage } from "@/lib/decode-image";
import { analyzeImage } from "@/lib/photo-render";
import { minCopies, nearTier, regularPrice, unitPrice } from "@/lib/pricing";
import { fileDetail, reportError } from "@/lib/report-error";
import { whatsappLink } from "@/lib/site";
import type { Adjust, Crop, Finish, PhotoView, Product } from "@/lib/types";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, putWithProgress, readImage, runPool } from "@/lib/upload-client";
import { CopiesInput, MAX_COPIES } from "./copies-input";
import { PhotoEditor } from "./photo-editor";
import { PrintShape } from "./print-shape";
import { QuickFrame } from "./quick-frame";


type Presigned = { name: string; key: string; thumbKey: string; uploadUrl: string; thumbUploadUrl: string };
type Failure = { name: string; message: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error("Sem conexão com o site. Confira a internet e tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Algo deu errado. Tente de novo.");
  return data as T;
}

export function Uploader({
  product,
  initialPhotos,
  storageReady,
}: {
  product: Product;
  initialPhotos: PhotoView[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  /** URLs locais (miniatura e original) das fotos enviadas nesta sessão. */
  const [localUrls, setLocalUrls] = useState<Record<string, { thumb: string; original: string }>>({});
  const urlsToRevoke = useRef<string[]>([]);

  const [photos, setPhotos] = useState(initialPhotos);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; ratio: number } | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  /** Fotos que já estavam na lista (mesmo nome e medidas) e ficaram de fora do envio, até o cliente confirmar. */
  const [skipped, setSkipped] = useState<File[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PhotoView | null>(null);
  /** Remoção com prazo para desfazer: a foto só é apagada de verdade depois de alguns segundos. */
  const pendingRemoval = useRef<{ photo: PhotoView; index: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [undoable, setUndoable] = useState<PhotoView | null>(null);

  useEffect(() => {
    const pending = pendingRemoval;
    // Saiu da página com uma remoção pendente: conclui a remoção mesmo assim.
    const flush = () => {
      const current = pending.current;
      if (!current) return;
      clearTimeout(current.timer);
      pending.current = null;
      fetch(`/api/photos/${current.photo.id}`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    const urls = urlsToRevoke.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const copies = photos.reduce((sum, p) => sum + p.quantity, 0);
  const unit = unitPrice(product, copies);
  const regular = regularPrice(product);
  const subtotal = copies * unit;
  const next = nearTier(product, copies);
  /** Mínimo de fotos do tamanho (Mini Polaroid: 2). Só cobra depois da primeira foto. */
  const minimum = minCopies(product);
  const missing = photos.length ? Math.max(0, minimum - copies) : 0;

  /** Modo "Enquadrar": no celular, libera arrastar as fotos para enquadrar sem abrir o editor. */
  const [framing, setFraming] = useState(false);
  /** Cópias para aplicar a todas as fotos de uma vez. */
  const [bulkCopies, setBulkCopies] = useState(1);
  /** Aviso visível por alguns segundos (envio concluído, ação aplicada a todas). */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function pickFiles() {
    openPicker();
  }

  /**
   * Abre a escolha de arquivos. No Android, o Chrome usa o seletor de fotos do sistema quando todos os tipos
   * aceitos são imagens, e esse seletor entrega arquivos que o Chrome não consegue ler (NotReadableError,
   * crbug.com/40123366). Um tipo a mais, que não é imagem, faz o Chrome abrir o seletor normal: Arquivos
   * filtrado em imagens, com Galeria, Fotos e Drive no menu. Não pode ser application/octet-stream, que tira o filtro.
   */
  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    const android = /Android/i.test(navigator.userAgent);
    input.accept = [...ACCEPTED_TYPES, ...(android ? ["application/x-fotoville"] : [])].join(",");
    input.click();
  }

  async function upload(fileList: FileList | File[]) {
    const files = [...fileList];
    if (!files.length || progress) return;

    const rejected: Failure[] = [];
    const valid = files.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push({ name: file.name, message: "Formato não aceito. Envie JPG, PNG ou WebP." });
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push({ name: file.name, message: "Arquivo maior que 40 MB. Envie uma versão menor." });
        return false;
      }
      return true;
    });

    // Lê o começo de cada foto já na seleção, enquanto o celular garante o acesso a ela.
    const probes = await Promise.all(
      valid.map((file) =>
        file
          .slice(0, 64 * 1024)
          .arrayBuffer()
          .then(
            () => null,
            (err: unknown) => err ?? "falha de leitura",
          ),
      ),
    );
    const ready = valid.filter((file, i) => {
      if (probes[i] === null) return true;
      reportError("envio", probes[i], { ...fileDetail(file), etapa: "leitura na seleção", product: product.id });
      rejected.push({ name: file.name, message: "Não foi possível ler esta foto. Selecione de novo." });
      return false;
    });
    setFailures(rejected);
    setNotice(null);
    if (!ready.length) return;

    // Repetida = mesmo nome e mesmas medidas de uma foto que já está neste tamanho. Fica de fora, com aviso.
    const fresh: File[] = [];
    const repeated: File[] = [];
    for (const file of ready) {
      const sameName = photos.filter((p) => p.file_name === file.name);
      if (!sameName.length) {
        fresh.push(file);
        continue;
      }
      let size: { width: number; height: number } | null = null;
      try {
        const decoded = await decodeImage(file);
        size = { width: decoded.width, height: decoded.height };
        decoded.close();
      } catch {
        // Não deu para medir: trata como nova e deixa o envio apontar o erro, se houver
      }
      const dup = size && sameName.some((p) => p.width_px === size.width && p.height_px === size.height);
      (dup ? repeated : fresh).push(file);
    }
    setSkipped(repeated);

    // Acabamento único do tamanho: não é escolha do cliente nem aparece no site
    if (fresh.length) await send(fresh, product.finishes[0]);
  }

  /** Remove todas as fotos deste tamanho do carrinho, depois da confirmação. */
  async function clearAll() {
    setClearing(true);
    try {
      await api(`/api/photos?product=${encodeURIComponent(product.id)}`, { method: "DELETE" });
      setPhotos([]);
      setSkipped([]);
      setConfirmClear(false);
      setNotice("Todas as fotos foram removidas.");
      setToast("Todas as fotos foram removidas.");
      router.refresh();
    } catch (err) {
      reportError("fotos", err, { etapa: "remover todas", product: product.id, count: photos.length });
      setNotice("Não foi possível remover as fotos. Tente de novo.");
      setToast("Não foi possível remover as fotos. Tente de novo.");
    }
    setClearing(false);
  }

  async function send(valid: File[], finish: Finish) {
    const ratios = new Array(valid.length).fill(0);
    let done = 0;
    let sent = 0;
    const report = () =>
      setProgress({ done, total: valid.length, ratio: ratios.reduce((a, b) => a + b, 0) / valid.length });
    report();

    await runPool(
      valid.map((file, index) => ({ file, index })),
      3,
      async ({ file, index }) => {
        let step = "leitura da imagem";
        try {
          const { width, height, thumb } = await readImage(file);
          step = "preparar envio";
          const { uploads } = await api<{ uploads: (Presigned & { error?: string })[] }>("/api/upload/presign", {
            method: "POST",
            body: JSON.stringify({ files: [{ name: file.name, type: file.type, size: file.size }] }),
          });
          const target = uploads[0];
          if (target.error) throw new Error(target.error);

          step = "envio ao armazenamento";
          await Promise.all([
            putWithProgress(target.uploadUrl, file, file.type, (r) => {
              ratios[index] = r * 0.95;
              report();
            }),
            putWithProgress(target.thumbUploadUrl, thumb, "image/jpeg"),
          ]);

          step = "registrar foto";
          const { photo } = await api<{ photo: PhotoView }>("/api/photos", {
            method: "POST",
            body: JSON.stringify({
              product_id: product.id,
              storage_key: target.key,
              thumb_key: target.thumbKey,
              file_name: file.name,
              width_px: width,
              height_px: height,
              finish,
            }),
          });

          const local = { thumb: URL.createObjectURL(thumb), original: URL.createObjectURL(file) };
          urlsToRevoke.current.push(local.thumb, local.original);
          setLocalUrls((map) => ({ ...map, [photo.id]: local }));
          setPhotos((list) => [...list, photo]);
          sent += 1;
        } catch (err) {
          reportError("envio", err, { ...fileDetail(file), etapa: step, product: product.id });
          const message =
            err instanceof DOMException && err.name === "NotReadableError"
              ? "A foto ficou indisponível durante o envio. Selecione de novo."
              : err instanceof Error
                ? err.message
                : "Não foi enviada. Tente de novo.";
          setFailures((list) => [...list, { name: file.name, message }]);
        } finally {
          ratios[index] = 1;
          done += 1;
          report();
        }
      },
    );

    setProgress(null);
    if (sent) {
      const message = `${plural(sent, "foto enviada", "fotos enviadas")}.`;
      setNotice(message);
      setToast(message);
    }
    router.refresh(); // atualiza o contador do carrinho no topo
  }

  /** Atualização otimista: aplica na tela, grava no servidor e desfaz se falhar. */
  async function patch(id: string, changes: Partial<Pick<PhotoView, "quantity" | "finish" | "crop" | "fit" | "adjust">>) {
    const before = photos;
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    try {
      await api(`/api/photos/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
      if (changes.quantity !== undefined) router.refresh(); // o contador do carrinho no topo soma as cópias
    } catch (err) {
      setPhotos(before);
      reportError("fotos", err, { etapa: "salvar alteração", photo: id, campos: Object.keys(changes) });
      throw err;
    }
  }

  const restore = (photo: PhotoView, index: number) =>
    setPhotos((list) => {
      const next = list.filter((p) => p.id !== photo.id);
      next.splice(Math.min(index, next.length), 0, photo);
      return next;
    });

  async function commitRemoval(photo: PhotoView, index: number) {
    try {
      await api(`/api/photos/${photo.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      reportError("fotos", err, { etapa: "remover foto", photo: photo.id });
      restore(photo, index);
      setNotice(`Não foi possível remover ${photo.file_name}. Ela voltou para a lista.`);
    }
  }

  /** Conclui agora a remoção pendente, se houver. */
  async function flushRemoval() {
    const pending = pendingRemoval.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRemoval.current = null;
    setUndoable(null);
    await commitRemoval(pending.photo, pending.index);
  }

  function remove(photo: PhotoView) {
    void flushRemoval();
    const index = photos.findIndex((p) => p.id === photo.id);
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    const timer = setTimeout(() => {
      pendingRemoval.current = null;
      setUndoable(null);
      void commitRemoval(photo, index);
    }, 6000);
    pendingRemoval.current = { photo, index, timer };
    setUndoable(photo);
    setNotice(`${photo.file_name} removida.`);
  }

  function undoRemoval() {
    const pending = pendingRemoval.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRemoval.current = null;
    setUndoable(null);
    restore(pending.photo, pending.index);
    setNotice(`${pending.photo.file_name} voltou para a lista.`);
  }

  async function applyToAll(changes: { quantity: number }) {
    const before = photos;
    setPhotos((list) => list.map((p) => ({ ...p, ...changes })));
    try {
      await Promise.all(
        before.map((p) => api(`/api/photos/${p.id}`, { method: "PATCH", body: JSON.stringify(changes) })),
      );
      setNotice("Aplicado a todas as fotos.");
      setToast("Aplicado a todas as fotos.");
      router.refresh();
    } catch (err) {
      reportError("fotos", err, { etapa: "aplicar a todas", ...changes, count: before.length });
      setPhotos(before);
      setNotice("Não foi possível aplicar a todas. Tente de novo.");
    }
  }

  const thumbOf = (p: PhotoView) => localUrls[p.id]?.thumb ?? p.thumb_url;
  const compact = photos.length > 0;

  const [autoBusy, setAutoBusy] = useState(false);
  const allAuto = photos.length > 0 && photos.every((p) => p.adjust?.auto);

  /** Liga o ajuste automático em todas as fotos (calculado pela miniatura) ou desliga em todas. */
  async function autoAll() {
    const before = photos;
    const next = new Map<string, Adjust | null>();
    setAutoBusy(true);
    if (allAuto) {
      for (const p of before) {
        const adjust = { ...(p.adjust ?? DEFAULT_ADJUST), auto: null };
        next.set(p.id, isNeutralAdjust(adjust) ? null : adjust);
      }
    } else {
      await runPool(
        before.filter((p) => !p.adjust?.auto),
        4,
        async (p) => {
          const src = thumbOf(p);
          if (!src) return;
          try {
            const image = await loadImage(src);
            const auto = analyzeImage(image);
            image.close();
            next.set(p.id, { ...(p.adjust ?? DEFAULT_ADJUST), auto });
          } catch (err) {
            // Miniatura indisponível: essa foto fica como está.
            reportError("ajuste", err, { etapa: "ajuste automático em todas", photo: p.id }, "warning");
          }
        },
      );
    }

    setPhotos((list) => list.map((p) => (next.has(p.id) ? { ...p, adjust: next.get(p.id)! } : p)));
    try {
      await Promise.all(
        [...next].map(([id, adjust]) => api(`/api/photos/${id}`, { method: "PATCH", body: JSON.stringify({ adjust }) })),
      );
      const message = allAuto ? "Ajuste automático removido de todas." : "Ajuste automático aplicado a todas.";
      setNotice(message);
      setToast(message);
    } catch (err) {
      reportError("ajuste", err, { etapa: "gravar ajuste automático em todas", count: next.size });
      setPhotos(before);
      setNotice("Não foi possível aplicar a todas. Tente de novo.");
    }
    setAutoBusy(false);
  }

  const editingIndex = editing ? photos.findIndex((p) => p.id === editing.id) : -1;
  const nextToEdit = editingIndex >= 0 ? photos[editingIndex + 1] : undefined;

  const goToCart = async (e: React.MouseEvent) => {
    if (progress) return e.preventDefault();
    if (pendingRemoval.current) {
      e.preventDefault();
      await flushRemoval();
      router.push("/carrinho");
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      id="arquivos"
      type="file"
      multiple
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const input = e.currentTarget;
        if (!input.files?.length) return;
        // Só limpa o campo depois do envio: no Android, limpar antes pode cortar o acesso às fotos.
        void upload(input.files).finally(() => {
          input.value = "";
        });
      }}
    />
  );

  const progressBar = progress && (
    <div className={compact ? "w-full" : "mx-auto mt-6 max-w-md"} role="status" aria-live="polite">
      <div
        className="h-2.5 overflow-hidden rounded-[2px] bg-rule"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.ratio * 100)}
        aria-label="Progresso do envio"
      >
        <div
          className="h-full origin-left bg-action transition-transform duration-200"
          style={{ transform: `scaleX(${progress.ratio})` }}
        />
      </div>
      <p className="mt-2 text-sm font-semibold">
        Enviando {Math.min(progress.done + 1, progress.total)} de {progress.total}. Não feche esta página.
      </p>
    </div>
  );

  return (
    <div>
      {!storageReady && (
        <p className="alert alert-warning mb-6" role="status">
          O armazenamento de fotos ainda não foi configurado neste ambiente (variáveis S3_*). O envio fica
          indisponível até lá.
        </p>
      )}

      {/* Com fotos, o resumo vai para uma coluna fixa à direita no desktop, como no carrinho e no pagamento */}
      <div className={compact ? "lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8" : undefined}>
        <div className="min-w-0">
          {/* Área de envio: clique, teclado ou arrastar e soltar */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            className={`rounded-panel border-2 border-dashed transition-colors duration-200 ${
              dragging ? "border-action bg-action-soft" : "border-action/40 bg-surface"
            } ${
              // Com fotos na lista, a área encolhe numa faixa: o que importa agora são as fotos
              compact ? "flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4" : "px-6 py-10 text-center"
            }`}
          >
            {fileInput}
            {compact ? (
              <>
                <ImagesIcon size={26} className="shrink-0 text-action" aria-hidden />
                <p className="min-w-0 flex-1 text-sm text-ink-2">
                  JPG, PNG ou WebP, até 40 MB.<span className="hidden sm:inline"> Ou arraste para cá.</span>
                </p>
                <button
                  type="button"
                  className="btn btn-outline w-full sm:w-auto"
                  disabled={!storageReady || Boolean(progress)}
                  onClick={pickFiles}
                >
                  Adicionar fotos
                </button>
                {progressBar}
              </>
            ) : (
              <>
                {/* O papel escolhido, na proporção dele: o cliente vê onde a foto vai entrar */}
                <div className="flex justify-center" aria-hidden>
                  <PrintShape
                    product={product}
                    scale={72 / Math.max(product.width_cm, product.height_cm)}
                    color="var(--color-action-soft)"
                  />
                </div>


                <button
                  type="button"
                  className="btn btn-accent btn-lg mt-6"
                  disabled={!storageReady || Boolean(progress)}
                  onClick={pickFiles}
                >
                  Selecionar fotos
                </button>
                <p className="mt-3 text-sm text-ink-2">
                  JPG, PNG ou WebP, até 40 MB.<span className="hidden sm:inline"> Ou arraste para cá.</span>
                </p>
                {minimum > 1 && <p className="mt-1 text-sm font-semibold">Mínimo de {minimum} fotos.</p>}
                {progressBar}
              </>
            )}
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {notice}
          </p>

          {failures.length > 0 && (
            <div className="alert alert-danger mt-4" role="alert">
              <WarningIcon size={20} aria-hidden className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">{plural(failures.length, "foto não foi enviada", "fotos não foram enviadas")}</p>
                <ul className="mt-1 space-y-0.5">
                  {failures.map((f, i) => (
                    <li key={`${f.name}-${i}`}>
                      <span className="font-semibold break-all">{f.name}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="alert alert-info mt-4" role="status">
              <CopyIcon size={20} aria-hidden className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {skipped.length === 1 ? "1 foto já está na lista" : `${skipped.length} fotos já estão na lista`}
                </p>
                <p className="mt-1 break-words">
                  {skipped.map((f) => f.name).join(", ")}. Para imprimir mais vezes, aumente as cópias.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={Boolean(progress)}
                    onClick={() => {
                      const files = skipped;
                      setSkipped([]);
                      void send(files, product.finishes[0]);
                    }}
                  >
                    Enviar mesmo assim
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipped([])}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-bold">
                  Suas fotos <span className="text-ink-2">({photos.length})</span>
                </h2>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="todas-copias" className="field-label">
                      Cópias de cada
                    </label>
                    <div className="flex gap-2">
                      <div className="flex min-h-11 w-20 items-center rounded-control border border-field bg-surface">
                        <CopiesInput
                          id="todas-copias"
                          key={bulkCopies}
                          value={bulkCopies}
                          label="Cópias de cada foto"
                          onCommit={setBulkCopies}
                          className="h-11 w-full rounded-control"
                        />
                      </div>
                      <button type="button" className="btn btn-outline" onClick={() => applyToAll({ quantity: bulkCopies })}>
                        Aplicar
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={framing}
                    className={`btn ${framing ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setFraming((v) => !v)}
                  >
                    <ArrowsOutCardinalIcon size={18} aria-hidden />
                    {framing ? "Concluir" : "Enquadrar"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={allAuto}
                    className={`btn ${allAuto ? "btn-primary" : "btn-outline"}`}
                    disabled={autoBusy}
                    onClick={autoAll}
                  >
                    {autoBusy ? (
                      <CircleNotchIcon size={18} className="spinner" aria-hidden />
                    ) : (
                      <MagicWandIcon size={18} aria-hidden />
                    )}
                    Ajuste automático
                  </button>
                  {confirmClear ? (
                    <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar remoção de todas as fotos">
                      <button type="button" className="btn bg-danger text-white hover:bg-danger/90" onClick={clearAll} disabled={clearing}>
                        {clearing && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
                        Remover {plural(photos.length, "foto", "fotos")}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)} disabled={clearing}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmClear(true)}>
                      <TrashIcon size={18} aria-hidden />
                      Remover todas
                    </button>
                  )}
                </div>
              </div>

              {framing && (
                <p className="mt-4 text-sm font-semibold text-action" role="status">
                  Arraste cada foto para enquadrar.
                </p>
              )}
              {/* Largura mínima em rem: com a fonte do sistema aumentada, a grade passa sozinha para uma coluna */}
              <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {photos.map((photo) => {
                  const lowRes = printDpi(photo, product) < LOW_DPI;
                  return (
                    <li key={photo.id} className="card flex flex-col p-3">
                      {/* Arrastar a prévia enquadra na hora; clicar abre o ajuste completo */}
                      <QuickFrame
                        src={thumbOf(photo)}
                        label={`Ajustar ${photo.file_name}. Arraste para enquadrar.`}
                        photo={photo}
                        product={product}
                        framing={framing}
                        onCommit={(crop) => patch(photo.id, { crop }).catch(() => setNotice("Não foi possível salvar o enquadramento."))}
                        onOpen={() => setEditing(photo)}
                      />
                      <p className="mt-2 truncate text-xs text-ink-2" title={photo.file_name}>
                        {photo.file_name}
                      </p>
                      {lowRes && (
                        <p className="badge mt-1 self-start bg-warning-soft text-warning">
                          <WarningIcon size={12} aria-hidden /> Resolução baixa
                        </p>
                      )}

                      {/* Contador numa linha só; Ajustar e remover na linha de baixo: cabe em cartões de 150px */}
                      <div className="mt-3">
                        <div
                          className="flex w-full items-center justify-between rounded-control border border-field"
                          role="group"
                          aria-label="Cópias"
                        >
                          <button
                            type="button"
                            className="inline-flex size-11 items-center justify-center rounded-control hover:bg-action-soft disabled:opacity-40"
                            aria-label={`Diminuir cópias de ${photo.file_name}`}
                            disabled={photo.quantity <= 1}
                            onClick={() => patch(photo.id, { quantity: photo.quantity - 1 }).catch(() => {})}
                          >
                            <MinusIcon size={18} aria-hidden />
                          </button>
                          <CopiesInput
                            key={photo.quantity}
                            value={photo.quantity}
                            label={`Cópias de ${photo.file_name}`}
                            onCommit={(n) => patch(photo.id, { quantity: n }).catch(() => {})}
                            className="h-11 flex-1"
                          />
                          <button
                            type="button"
                            className="inline-flex size-11 items-center justify-center rounded-control hover:bg-action-soft disabled:opacity-40"
                            aria-label={`Aumentar cópias de ${photo.file_name}`}
                            disabled={photo.quantity >= MAX_COPIES}
                            onClick={() => patch(photo.id, { quantity: photo.quantity + 1 }).catch(() => {})}
                          >
                            <PlusIcon size={18} aria-hidden />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <button type="button" className="btn btn-outline min-w-0 flex-1 px-3" onClick={() => setEditing(photo)}>
                          <SlidersHorizontalIcon size={16} aria-hidden className="shrink-0" />
                          Ajustar
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                          aria-label={`Remover ${photo.file_name}`}
                          onClick={() => remove(photo)}
                        >
                          <TrashIcon size={18} aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Resumo no desktop: coluna fixa à direita */}
        {compact && (
          <aside
            className="card mt-10 hidden p-5 lg:sticky lg:top-24 lg:mt-0 lg:block print:hidden"
            aria-labelledby="resumo-envio"
          >
            <h2 id="resumo-envio" className="text-xl font-bold">
              Resumo
            </h2>
            <p className="mt-3 text-ink-2">
              {plural(copies, "foto", "fotos")} {product.name}
              {unit < regular && (
                <>
                  ,{" "}
                  <s className="text-ink-3">
                    <span className="sr-only">de </span>
                    {formatBRL(regular)}
                  </s>{" "}
                  {formatBRL(unit)} cada
                </>
              )}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatBRL(subtotal)}</p>
            {missing > 0 ? (
              <p className="alert alert-warning mt-3" role="status">
                Mínimo de {minimum} fotos neste tamanho. Adicione mais {missing}.
              </p>
            ) : (
              next && (
                <p className="mt-2 text-sm font-semibold text-success">
                  Com mais {next.min - copies} fotos, {formatBRL(next.price_cents)} cada.
                </p>
              )
            )}
            <Link
              href="/carrinho"
              aria-disabled={Boolean(progress)}
              className="btn btn-accent btn-lg mt-5 w-full"
              onClick={goToCart}
            >
              Ir para o carrinho
            </Link>
            <Link href="/enviar" className="btn btn-ghost mt-2 w-full">
              Outro tamanho
            </Link>
            <p className="mt-4 border-t border-rule pt-3 text-center text-sm">
              Dúvidas?{" "}
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="link">
                Falar no WhatsApp
              </a>
            </p>
          </aside>
        )}
      </div>

      {/* Resumo no celular: barra fixa embaixo, opaca, com a próxima ação */}
      {compact && (
        <>
          <div className="h-24 lg:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
            <div className="container-page flex items-center justify-between gap-3 py-3">
              <p className="min-w-0 leading-tight">
                <span className="block font-display text-lg font-bold tabular-nums">{formatBRL(subtotal)}</span>
                <span className="block truncate text-sm text-ink-2">
                  {plural(copies, "foto", "fotos")} {product.name}
                </span>
                {missing > 0 ? (
                  <span className="block text-sm font-semibold text-warning">
                    Mínimo {minimum}: adicione mais {missing}
                  </span>
                ) : (
                  next && (
                    <span className="block text-sm font-semibold text-success">
                      Com mais {next.min - copies} fotos, {formatBRL(next.price_cents)} cada
                    </span>
                  )
                )}
              </p>
              <Link href="/carrinho" aria-disabled={Boolean(progress)} className="btn btn-accent shrink-0" onClick={goToCart}>
                Ir para o carrinho
              </Link>
            </div>
          </div>
        </>
      )}

      {(undoable || toast) && (
        <div
          role="status"
          className="fixed bottom-28 left-1/2 z-40 flex w-[min(100vw-2rem,28rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-control bg-ink py-2 pr-2 pl-4 text-surface shadow-lift lg:bottom-8"
        >
          {undoable ? (
            <>
              <p className="min-w-0 truncate text-sm">
                <span className="font-semibold">{undoable.file_name}</span> removida
              </p>
              <button type="button" onClick={undoRemoval} className="btn btn-sm shrink-0 text-surface underline hover:bg-surface/10">
                Desfazer
              </button>
            </>
          ) : (
            <p className="py-2 text-sm font-semibold">{toast}</p>
          )}
        </div>
      )}

      {editing && (
        <PhotoEditor
          key={editing.id}
          photo={editing}
          product={product}
          localUrl={localUrls[editing.id]?.original}
          place={editingIndex >= 0 ? { index: editingIndex, total: photos.length } : undefined}
          onClose={() => setEditing(null)}
          onSave={async (changes: { crop: Crop; fit: boolean; adjust: Adjust | null }) => {
            await patch(editing.id, changes);
            setEditing(null);
          }}
          onSaveNext={
            nextToEdit
              ? async (changes: { crop: Crop; fit: boolean; adjust: Adjust | null }) => {
                  await patch(editing.id, changes);
                  setEditing(nextToEdit);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
