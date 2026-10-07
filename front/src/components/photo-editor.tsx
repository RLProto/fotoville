"use client";

import {
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  CropIcon,
  DropHalfIcon,
  FrameCornersIcon,
  MagicWandIcon,
  ProhibitIcon,
  RectangleIcon,
  TextAaIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  BORDER_COLORS,
  BORDER_MM,
  CAPTION_MAX,
  DEFAULT_ADJUST,
  hasToneChange,
  isNeutralAdjust,
  normalizeAdjust,
} from "@/lib/adjust";
import { CAPTION_FONTS } from "@/lib/caption-fonts";
import { cropAspect, fitCrop, isLandscape, LOW_DPI, paperLayout, printDpi } from "@/lib/crop";
import { loadImage } from "@/lib/decode-image";
import { analyzeImage, applyTone, renderPrint } from "@/lib/photo-render";
import { reportError } from "@/lib/report-error";
import type { Adjust, BorderColor, CaptionFont, Crop, PhotoView, Product } from "@/lib/types";

type Tab = "corte" | "cor" | "papel";
type Tone = Pick<Adjust, "auto" | "brightness" | "contrast" | "saturation" | "bw">;

/** Cópia reduzida do original usada no editor: leve para arrastar e redesenhar a cada ajuste. */
const WORK_MAX_SIDE = 1600;
/** Lado maior da prévia final, em pixels. */
const PREVIEW_SIDE = 1100;

const NEUTRAL_TONE: Tone = { auto: null, brightness: 0, contrast: 0, saturation: 0, bw: false };

export function PhotoEditor({
  photo,
  product,
  localUrl,
  place,
  onClose,
  onSave,
  onSaveNext,
}: {
  photo: PhotoView;
  product: Product;
  /** URL local do arquivo original, quando ele acabou de ser enviado nesta sessão. */
  localUrl?: string;
  /** Posição da foto na lista, para o "Foto 3 de 12". */
  place?: { index: number; total: number };
  onClose: () => void;
  onSave: (patch: { crop: Crop; fit: boolean; adjust: Adjust | null }) => Promise<void>;
  /** Salva e abre a próxima foto da lista; ausente na última. */
  onSaveNext?: (patch: { crop: Crop; fit: boolean; adjust: Adjust | null }) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const tabsId = useId();
  const polaroid = product.kind === "polaroid";
  const square = polaroid || product.width_cm === product.height_cm;
  const start = photo.adjust ?? DEFAULT_ADJUST;

  const [work, setWork] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>("corte");

  const [landscape, setLandscape] = useState(
    photo.crop ? photo.crop.width >= photo.crop.height : photo.width_px >= photo.height_px,
  );
  const [fit, setFit] = useState(photo.fit);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Crop | null>(photo.crop);

  const [tone, setTone] = useState<Tone>({ ...NEUTRAL_TONE, ...pickTone(start) });
  const autoTone = useRef(start.auto);
  const [borderColor, setBorderColor] = useState<BorderColor | null>(start.border?.color ?? null);
  const [borderMm, setBorderMm] = useState(start.border?.mm ?? BORDER_MM.initial);
  const [captionText, setCaptionText] = useState(start.caption?.text ?? "");
  const [captionFontId, setCaptionFontId] = useState<CaptionFont>(start.caption?.font ?? "caneta");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjust = useMemo(
    () =>
      normalizeAdjust(
        {
          ...tone,
          border: borderColor ? { color: borderColor, mm: borderMm } : null,
          caption: { text: captionText, font: captionFontId },
        },
        product,
      ),
    [tone, borderColor, borderMm, captionText, captionFontId, product],
  );
  const draft = useMemo(
    () => ({ width_px: photo.width_px, height_px: photo.height_px, crop: pixels, fit, adjust }),
    [photo.width_px, photo.height_px, pixels, fit, adjust],
  );
  const showCropper = tab === "corte" && !fit;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Original reduzido para trabalhar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let url = localUrl;
      if (!url) {
        const res = await fetch(`/api/photos/${photo.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        url = ((await res.json()) as { url: string }).url;
      }
      const source = await loadImage(url);
      const s = Math.min(1, WORK_MAX_SIDE / Math.max(source.width, source.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * s));
      canvas.height = Math.max(1, Math.round(source.height * s));
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      source.close();
      if (!cancelled) setWork(canvas);
    })().catch((err) => {
      if (cancelled) return;
      reportError("editor", err, {
        etapa: "abrir foto",
        photo: photo.id,
        medidas: `${photo.width_px}x${photo.height_px}`,
        local: Boolean(localUrl),
      });
      setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.width_px, photo.height_px, localUrl]);

  // Imagem do enquadramento, já com a cor ajustada. Só é refeita quando a cor muda.
  const [cropperImage, setCropperImage] = useState<{ key: string; url: string } | null>(null);
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  useEffect(() => {
    const key = JSON.stringify(tone);
    if (!work || !showCropper || cropperImage?.key === key) return;
    let cancelled = false;
    const copy = document.createElement("canvas");
    copy.width = work.width;
    copy.height = work.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(work, 0, 0);
    const toned = { ...DEFAULT_ADJUST, ...tone };
    if (hasToneChange(toned)) {
      const data = ctx.getImageData(0, 0, copy.width, copy.height);
      applyTone(data.data, toned);
      ctx.putImageData(data, 0, 0);
    }
    copy.toBlob(
      (blob) => {
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrls.current.push(url);
        setCropperImage({ key, url });
      },
      "image/jpeg",
      0.9,
    );
    return () => {
      cancelled = true;
    };
  }, [work, showCropper, tone, cropperImage?.key]);

  // Prévia final: papel, borda ou moldura, cor e legenda
  useEffect(() => {
    const canvas = previewRef.current;
    if (!work || showCropper || !canvas) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const layout = paperLayout(product, isLandscape(draft), draft.adjust);
      const off = document.createElement("canvas");
      renderPrint(
        off,
        { image: work, width: work.width, height: work.height },
        draft,
        product,
        PREVIEW_SIDE / Math.max(layout.width, layout.height),
      )
        .then(() => {
          if (cancelled) return;
          canvas.width = off.width;
          canvas.height = off.height;
          canvas.getContext("2d")!.drawImage(off, 0, 0);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [work, showCropper, draft, product]);

  const dpi = printDpi(draft, product);
  const neutral = isNeutralAdjust(adjust);

  /** Área do corte em porcentagem, convertida para pixels do original. */
  function onArea(area: Area) {
    const x = Math.min(photo.width_px - 1, Math.max(0, Math.round((area.x / 100) * photo.width_px)));
    const y = Math.min(photo.height_px - 1, Math.max(0, Math.round((area.y / 100) * photo.height_px)));
    setPixels({
      x,
      y,
      width: Math.max(1, Math.min(photo.width_px - x, Math.round((area.width / 100) * photo.width_px))),
      height: Math.max(1, Math.min(photo.height_px - y, Math.round((area.height / 100) * photo.height_px))),
    });
  }

  function toggleAuto() {
    if (tone.auto) return setTone((t) => ({ ...t, auto: null }));
    if (!work) return;
    autoTone.current ??= analyzeImage({ image: work, width: work.width, height: work.height });
    const auto = autoTone.current;
    setTone((t) => ({ ...t, auto }));
  }

  async function save(next = false) {
    if (!pixels) return;
    setSaving(true);
    setError(null);
    try {
      // A borda muda a proporção da janela: o corte acompanha, na orientação dele mesmo.
      const crop = fitCrop(pixels, cropAspect(product, pixels.width >= pixels.height, adjust));
      const patch = { crop, fit, adjust: neutral ? null : adjust };
      await (next && onSaveNext ? onSaveNext(patch) : onSave(patch));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; Icon: typeof CropIcon }[] = [
    { id: "corte", label: "Corte", Icon: CropIcon },
    { id: "cor", label: "Cor", Icon: DropHalfIcon },
    polaroid
      ? { id: "papel", label: "Legenda", Icon: TextAaIcon }
      : { id: "papel", label: "Borda", Icon: FrameCornersIcon },
  ];

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setTab(next.id);
    document.getElementById(`${tabsId}-${next.id}`)?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="editor-title"
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(100vw-1.5rem,44rem)] max-w-none overflow-hidden rounded-panel bg-surface p-0 shadow-lift backdrop:bg-ink/70 open:flex open:flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-rule px-5 py-3">
        <div className="min-w-0">
          <h2 id="editor-title" className="text-lg font-bold">
            Ajustar foto
            {place && place.total > 1 && (
              <span className="font-normal text-ink-2">
                {" "}
                {place.index + 1} de {place.total}
              </span>
            )}
          </h2>
          <p className="truncate text-sm text-ink-2">
            {product.name}, {photo.file_name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fechar"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-action-soft"
        >
          <XIcon size={22} aria-hidden />
        </button>
      </div>

      <div className="relative h-[min(40vh,26rem)] shrink-0 bg-ink sm:h-[min(50vh,26rem)]">
        {loadError ? (
          <p className="flex size-full items-center justify-center px-6 text-center text-white">
            Não foi possível carregar a foto. Feche e tente de novo.
          </p>
        ) : !work || (showCropper && !cropperImage) ? (
          <div className="flex size-full items-center justify-center text-white" role="status">
            <CircleNotchIcon className="spinner" size={32} aria-hidden />
            <span className="sr-only">Carregando foto…</span>
          </div>
        ) : showCropper && cropperImage ? (
          <Cropper
            image={cropperImage.url}
            crop={position}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={cropAspect(product, landscape, adjust)}
            initialCroppedAreaPercentages={
              pixels
                ? {
                    x: (pixels.x / photo.width_px) * 100,
                    y: (pixels.y / photo.height_px) * 100,
                    width: (pixels.width / photo.width_px) * 100,
                    height: (pixels.height / photo.height_px) * 100,
                  }
                : undefined
            }
            onCropChange={setPosition}
            onZoomChange={setZoom}
            onCropAreaChange={onArea}
            showGrid
            objectFit="contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center p-4 sm:p-6">
            <canvas
              ref={previewRef}
              role="img"
              aria-label="Prévia da impressão"
              className="block max-h-full min-h-0 max-w-full min-w-0 rounded-[2px]"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div role="tablist" aria-label="Ajustes" className="flex gap-1 border-b border-rule px-5 pt-2">
          {tabs.map(({ id, label, Icon }, i) => (
            <button
              key={id}
              id={`${tabsId}-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${tabsId}-painel`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors ${
                tab === id ? "border-action text-action" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div id={`${tabsId}-painel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="space-y-4 px-5 py-4">
          {tab === "corte" && (
            <>
              {!fit && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="flex min-w-48 flex-1 items-center gap-3 text-sm font-bold">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="h-11 flex-1 accent-action"
                    />
                  </label>
                  {!square && (
                    <div role="group" aria-label="Orientação do papel" className="flex gap-1 rounded-control bg-paper p-1">
                      {[
                        { value: false, label: "Retrato", rotate: true },
                        { value: true, label: "Paisagem", rotate: false },
                      ].map(({ value, label, rotate }) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={landscape === value}
                          onClick={() => {
                            setLandscape(value);
                            setPosition({ x: 0, y: 0 });
                            setZoom(1);
                          }}
                          className={`btn btn-sm ${landscape === value ? "bg-action text-white" : "text-ink hover:bg-action-soft"}`}
                        >
                          <RectangleIcon size={16} aria-hidden className={rotate ? "rotate-90" : undefined} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={fit}
                  onChange={(e) => setFit(e.target.checked)}
                  className="size-5 accent-action"
                />
                <span>
                  <span className="font-bold">Imprimir a foto inteira</span>
                  <span className="block text-sm text-ink-2">A foto não é cortada.</span>
                </span>
              </label>
              {fit ? (
                <p className="alert alert-warning" role="status">
                  <WarningIcon size={20} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    Atenção: a proporção da foto é diferente da do papel,{" "}
                    <strong>a foto impressa terá margens brancas.</strong>
                  </span>
                </p>
              ) : (
                <p className="text-sm text-ink-2">Arraste para posicionar a foto.</p>
              )}
            </>
          )}

          {tab === "cor" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={Boolean(tone.auto)}
                  disabled={!work}
                  onClick={toggleAuto}
                  className={`btn btn-sm ${tone.auto ? "btn-primary" : "btn-outline"}`}
                >
                  <MagicWandIcon size={18} aria-hidden />
                  Ajuste automático
                </button>
                <button
                  type="button"
                  aria-pressed={tone.bw}
                  onClick={() => setTone((t) => ({ ...t, bw: !t.bw }))}
                  className={`btn btn-sm ${tone.bw ? "btn-primary" : "btn-outline"}`}
                >
                  Preto e branco
                </button>
                {hasToneChange({ ...DEFAULT_ADJUST, ...tone }) && (
                  <button type="button" onClick={() => setTone(NEUTRAL_TONE)} className="btn btn-ghost btn-sm ml-auto">
                    <ArrowCounterClockwiseIcon size={16} aria-hidden />
                    Restaurar
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <Slider label="Luz" value={tone.brightness} onChange={(v) => setTone((t) => ({ ...t, brightness: v }))} />
                <Slider label="Contraste" value={tone.contrast} onChange={(v) => setTone((t) => ({ ...t, contrast: v }))} />
                {!tone.bw && (
                  <Slider
                    label="Saturação"
                    value={tone.saturation}
                    onChange={(v) => setTone((t) => ({ ...t, saturation: v }))}
                  />
                )}
              </div>
            </>
          )}

          {tab === "papel" && !polaroid && (
            <>
              <fieldset>
                <legend className="field-label">Cor da borda</legend>
                <div className="flex flex-wrap gap-2">
                  <Swatch
                    name="borda"
                    label="Sem borda"
                    checked={borderColor === null}
                    onChange={() => setBorderColor(null)}
                    className="bg-surface text-ink-2"
                  >
                    <ProhibitIcon size={20} aria-hidden />
                  </Swatch>
                  {BORDER_COLORS.map((c) => (
                    <Swatch
                      key={c.id}
                      name="borda"
                      label={c.label}
                      checked={borderColor === c.id}
                      onChange={() => setBorderColor(c.id)}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </fieldset>
              {borderColor && (
                <Slider
                  label="Espessura"
                  value={borderMm}
                  min={BORDER_MM.min}
                  max={BORDER_MM.max}
                  format={(v) => `${v} mm`}
                  onChange={setBorderMm}
                />
              )}
            </>
          )}

          {tab === "papel" && polaroid && (
            <>
              <div>
                <label htmlFor="legenda" className="field-label">
                  Texto
                </label>
                <input
                  id="legenda"
                  type="text"
                  value={captionText}
                  maxLength={CAPTION_MAX}
                  placeholder="Escreva algo"
                  autoComplete="off"
                  onChange={(e) => setCaptionText(e.target.value)}
                  className="field-input"
                />
              </div>
              <fieldset>
                <legend className="field-label">Letra</legend>
                <div className="grid grid-cols-5 gap-2">
                  {CAPTION_FONTS.map((f) => (
                    <label
                      key={f.id}
                      className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-control border px-1 py-1.5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action ${
                        captionFontId === f.id ? "border-action bg-action-soft" : "border-rule hover:border-ink-2"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fonte"
                        className="sr-only"
                        checked={captionFontId === f.id}
                        onChange={() => setCaptionFontId(f.id)}
                      />
                      <span aria-hidden className={`${f.className} text-2xl leading-tight text-ink`}>
                        Aa
                      </span>
                      <span className="text-xs font-semibold text-ink-2">{f.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-rule px-5 py-3">
        {dpi < LOW_DPI && (
          <p className="alert alert-warning" role="status">
            Resolução baixa para este tamanho. A foto pode sair sem nitidez.
          </p>
        )}
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
          {onSaveNext ? (
            <>
              <button type="button" className="btn btn-outline" onClick={() => save()} disabled={saving || !pixels}>
                Salvar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={saving || !pixels}>
                {saving && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
                {saving ? "Salvando…" : "Salvar e próxima"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving || !pixels}>
              {saving && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
              {saving ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

function pickTone(a: Adjust): Tone {
  return { auto: a.auto, brightness: a.brightness, contrast: a.contrast, saturation: a.saturation, bw: a.bw };
}

function Slider({
  label,
  value,
  onChange,
  min = -100,
  max = 100,
  format = (v) => (v > 0 ? `+${v}` : `${v}`),
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[6rem_1fr_3.25rem] items-center gap-3">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-action"
      />
      <output htmlFor={id} className="text-right text-sm text-ink-2 tabular-nums">
        {format(value)}
      </output>
    </div>
  );
}

function Swatch({
  name,
  label,
  checked,
  onChange,
  className = "",
  style,
  children,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <label
      title={label}
      className={`relative inline-flex size-11 cursor-pointer items-center justify-center rounded-control ring-1 ring-ink/20 ring-inset has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action ${
        checked ? "outline-2 outline-offset-2 outline-action" : ""
      } ${className}`}
      style={style}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}
