"use client";

import {
  CircleNotchIcon,
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
import { loadImage } from "@/lib/decode-image";
import { analyzeImage } from "@/lib/photo-render";
import { nearTier, unitPrice } from "@/lib/pricing";
import { fileDetail, reportError } from "@/lib/report-error";
import { FINISH_LABEL, type Adjust, type Crop, type Finish, type PhotoView, type Product } from "@/lib/types";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, putWithProgress, readImage, runPool } from "@/lib/upload-client";
import { FinishDialog } from "./finish-dialog";
import { PhotoEditor } from "./photo-editor";
import { PrintPreview } from "./print-preview";

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
  const subtotal = copies * unit;
  const next = nearTier(product, copies);

  /** Acabamento em uso: o de todas as fotos, ou null se estiverem misturados ou não houver fotos. */
  const uniformFinish = photos.length && photos.every((p) => p.finish === photos[0].finish) ? photos[0].finish : null;
  /**
   * Pergunta do acabamento no primeiro envio: antes de abrir a galeria ("galeria") ou, ao arrastar
   * arquivos, com os arquivos já escolhidos.
   */
  const [finishPrompt, setFinishPrompt] = useState<"galeria" | File[] | null>(null);
  /** Acabamento escolhido no popup antes de abrir a galeria. */
  const [chosenFinish, setChosenFinish] = useState<Finish | null>(null);

  function pickFiles() {
    if (!photos.length && !chosenFinish && product.finishes.length > 1) return setFinishPrompt("galeria");
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
    if (!files.length || progress || finishPrompt) return;

    const rejected: Failure[] = [];
    const valid = files.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push({ name: file.name, message: "Formato não aceito. Envie JPG, PNG ou WebP." });
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push({ name: file.name, message: "Arquivo maior que 40 MB." });
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
      rejected.push({ name: file.name, message: "Não foi possível ler esta foto. Escolha de novo." });
      return false;
    });
    setFailures(rejected);
    setNotice(null);
    if (!ready.length) return;

    // Primeiro envio deste tamanho: vale o acabamento escolhido no popup. Depois, as novas seguem as que já estão aqui.
    const finish = photos.length ? (uniformFinish ?? photos[0].finish) : chosenFinish;
    if (!finish && product.finishes.length > 1) return setFinishPrompt(ready);
    await send(ready, finish ?? product.finishes[0]);
  }

  async function send(valid: File[], finish: Finish) {
    const ratios = new Array(valid.length).fill(0);
    let done = 0;
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
        } catch (err) {
          reportError("envio", err, { ...fileDetail(file), etapa: step, product: product.id });
          const message =
            err instanceof DOMException && err.name === "NotReadableError"
              ? "A foto ficou indisponível durante o envio. Escolha de novo."
              : err instanceof Error
                ? err.message
                : "Falha no envio.";
          setFailures((list) => [...list, { name: file.name, message }]);
        } finally {
          ratios[index] = 1;
          done += 1;
          report();
        }
      },
    );

    setProgress(null);
    setNotice(`${plural(valid.length, "foto enviada", "fotos enviadas")}.`);
    router.refresh(); // atualiza o contador do carrinho no topo
  }

  /** Atualização otimista: aplica na tela, grava no servidor e desfaz se falhar. */
  async function patch(id: string, changes: Partial<Pick<PhotoView, "quantity" | "finish" | "crop" | "fit" | "adjust">>) {
    const before = photos;
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    try {
      await api(`/api/photos/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
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

  async function applyToAll(changes: { finish?: Finish; quantity?: number }) {
    const before = photos;
    setPhotos((list) => list.map((p) => ({ ...p, ...changes })));
    try {
      await Promise.all(
        before.map((p) => api(`/api/photos/${p.id}`, { method: "PATCH", body: JSON.stringify(changes) })),
      );
      setNotice("Aplicado a todas as fotos.");
    } catch (err) {
      reportError("fotos", err, { etapa: "aplicar a todas", ...changes, count: before.length });
      setPhotos(before);
      setNotice("Não foi possível aplicar a todas. Tente de novo.");
    }
  }

  const thumbOf = (p: PhotoView) => localUrls[p.id]?.thumb ?? p.thumb_url;

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
      setNotice(allAuto ? "Ajuste automático removido de todas." : "Ajuste automático aplicado a todas.");
    } catch (err) {
      reportError("ajuste", err, { etapa: "gravar ajuste automático em todas", count: next.size });
      setPhotos(before);
      setNotice("Não foi possível aplicar a todas. Tente de novo.");
    }
    setAutoBusy(false);
  }

  return (
    <div>
      {!storageReady && (
        <p className="alert alert-warning mb-6" role="status">
          O armazenamento de fotos ainda não foi configurado neste ambiente (variáveis S3_*). O envio fica
          indisponível até lá.
        </p>
      )}

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
        className={`rounded-panel border-2 border-dashed p-8 text-center transition-colors duration-200 ${
          dragging ? "border-action bg-action-soft" : "border-action/40 bg-surface"
        }`}
      >
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-control bg-action-soft text-action">
          <ImagesIcon size={28} aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold">
          {photos.length ? "Adicionar mais fotos" : "Escolha as fotos"}
        </p>
        <p className="mt-1 text-ink-2">
          <span className="hidden sm:inline">Ou arraste para cá. </span>JPG, PNG ou WebP, até 40 MB.
        </p>
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
        <div>
          <button
            type="button"
            className="btn btn-accent mt-5"
            disabled={!storageReady || Boolean(progress)}
            onClick={pickFiles}
          >
            Selecionar fotos
          </button>
        </div>

        {progress && (
          <div className="mx-auto mt-6 max-w-md" role="status" aria-live="polite">
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
              Enviando {Math.min(progress.done + 1, progress.total)} de {progress.total}… não feche esta página.
            </p>
          </div>
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

      {photos.length > 0 && (
        <>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold">
              Suas fotos <span className="text-ink-2">({photos.length})</span>
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              {product.finishes.length > 1 && (
                <div>
                  <label htmlFor="todas-acabamento" className="field-label">
                    Acabamento
                  </label>
                  <select
                    id="todas-acabamento"
                    className="field-input w-auto"
                    value={uniformFinish ?? ""}
                    onChange={(e) => e.target.value && applyToAll({ finish: e.target.value as Finish })}
                  >
                    {!uniformFinish && <option value="">Escolher…</option>}
                    {product.finishes.map((f) => (
                      <option key={f} value={f}>
                        {FINISH_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="todas-copias" className="field-label">
                  Cópias
                </label>
                <select
                  id="todas-copias"
                  className="field-input w-auto"
                  value=""
                  onChange={(e) => e.target.value && applyToAll({ quantity: Number(e.target.value) })}
                >
                  <option value="">Escolher…</option>
                  {[1, 2, 3, 4, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => {
              const lowRes = printDpi(photo, product) < LOW_DPI;
              return (
                <li key={photo.id} className="card flex flex-col p-3">
                  <PrintPreview src={thumbOf(photo)} alt={`Prévia de ${photo.file_name}`} photo={photo} product={product} />
                  <p className="mt-2 truncate text-sm font-semibold" title={photo.file_name}>
                    {photo.file_name}
                  </p>
                  {lowRes && (
                    <p className="badge mt-1 self-start bg-warning-soft text-warning">
                      <WarningIcon size={12} aria-hidden /> Resolução baixa
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-control border border-field" role="group" aria-label="Cópias">
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-control hover:bg-action-soft disabled:opacity-40"
                        aria-label={`Diminuir cópias de ${photo.file_name}`}
                        disabled={photo.quantity <= 1}
                        onClick={() => patch(photo.id, { quantity: photo.quantity - 1 }).catch(() => {})}
                      >
                        <MinusIcon size={18} aria-hidden />
                      </button>
                      <span className="min-w-7 text-center font-bold tabular-nums" aria-live="polite">
                        {photo.quantity}
                      </span>
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-control hover:bg-action-soft disabled:opacity-40"
                        aria-label={`Aumentar cópias de ${photo.file_name}`}
                        disabled={photo.quantity >= 999}
                        onClick={() => patch(photo.id, { quantity: photo.quantity + 1 }).catch(() => {})}
                      >
                        <PlusIcon size={18} aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                      aria-label={`Remover ${photo.file_name}`}
                      onClick={() => remove(photo)}
                    >
                      <TrashIcon size={18} aria-hidden />
                    </button>
                  </div>

                  <button type="button" className="btn btn-outline btn-sm mt-2" onClick={() => setEditing(photo)}>
                    <SlidersHorizontalIcon size={16} aria-hidden />
                    Ajustar
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Resumo fixo: o próximo passo fica sempre à mão */}
      {photos.length > 0 && (
        <div className="sticky bottom-0 z-20 mt-10 -mx-4 border-t border-rule bg-surface/95 backdrop-blur-sm sm:-mx-6 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 pr-20 sm:px-6 sm:pr-24">
            <p className="leading-tight">
              <span className="block text-lg font-extrabold tabular-nums" style={{ fontStretch: "112%" }}>
                {formatBRL(subtotal)}
              </span>
              <span className="text-sm text-ink-2">
                {plural(copies, "foto", "fotos")} {product.name}
                {unit < product.price_cents && <>, {formatBRL(unit)} cada</>}
              </span>
              {next && (
                <span className="block text-sm font-semibold text-success">
                  Com mais {next.min - copies}, {formatBRL(next.price_cents)} cada
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Link href="/enviar" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Outro tamanho
              </Link>
              <Link
                href="/carrinho"
                aria-disabled={Boolean(progress)}
                className="btn btn-accent"
                onClick={async (e) => {
                  if (progress) return e.preventDefault();
                  if (pendingRemoval.current) {
                    e.preventDefault();
                    await flushRemoval();
                    router.push("/carrinho");
                  }
                }}
              >
                Ir para o carrinho
              </Link>
            </div>
          </div>
        </div>
      )}

      {undoable && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-40 flex w-[min(100vw-2rem,28rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-control bg-ink py-2 pr-2 pl-4 text-surface shadow-lift"
        >
          <p className="min-w-0 truncate text-sm">
            <span className="font-semibold">{undoable.file_name}</span> removida
          </p>
          <button type="button" onClick={undoRemoval} className="btn btn-sm shrink-0 text-surface underline hover:bg-surface/10">
            Desfazer
          </button>
        </div>
      )}

      {finishPrompt && (
        <FinishDialog
          finishes={product.finishes}
          onCancel={() => setFinishPrompt(null)}
          onChoose={(finish) => {
            setFinishPrompt(null);
            setChosenFinish(finish);
            // Galeria: abre agora, ainda no toque do cliente. Arquivos arrastados: envia direto.
            if (finishPrompt === "galeria") openPicker();
            else void send(finishPrompt, finish);
          }}
        />
      )}

      {editing && (
        <PhotoEditor
          photo={editing}
          product={product}
          localUrl={localUrls[editing.id]?.original}
          onClose={() => setEditing(null)}
          onSave={async (changes: { crop: Crop; fit: boolean; adjust: Adjust | null }) => {
            await patch(editing.id, changes);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
