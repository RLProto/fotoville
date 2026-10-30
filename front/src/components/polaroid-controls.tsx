"use client";

import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { EmojiPicker, type EmojiPickerListComponents } from "frimousse";
import { useEffect, useMemo, useRef, useState } from "react";
import { BORDER_COLORS, FRAME_PALETTE } from "@/lib/adjust";

/** Controles da Polaroid no editor de foto: emojis da legenda e paleta maior da moldura. */

/** Dados do Emojibase em português, servidos pelo próprio site (public/emojibase), sem depender de CDN. */
const EMOJIBASE_URL = "/emojibase/18";
const EMOJI_PX = 40;

/**
 * Todos os emojis, com busca em português e tom de pele. Só aparecem os que o aparelho sabe desenhar.
 * O número de colunas acompanha a largura do painel.
 */
export function EmojiPanel({ id, onPick }: { id: string; onPick: (emoji: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      // Desconta a margem das linhas e a barra de rolagem
      setColumns(Math.max(6, Math.floor((entry.contentRect.width - 24) / EMOJI_PX))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fora do render: componente novo a cada render remontaria todas as linhas
  const components = useMemo<Partial<EmojiPickerListComponents>>(
    () => ({
      CategoryHeader: ({ category, ...props }) => (
        <div className="bg-surface px-2 pt-2.5 pb-1 text-xs font-bold text-ink-2" {...props}>
          {category.label}
        </div>
      ),
      Row: ({ children, ...props }) => (
        <div className="flex scroll-my-1 px-1" {...props}>
          {children}
        </div>
      ),
      Emoji: ({ emoji, style, ...props }) => (
        <button
          type="button"
          className="flex items-center justify-center rounded-control text-[1.6rem] data-[active]:bg-action-soft"
          style={{ ...style, width: `${100 / columns}%`, height: EMOJI_PX }}
          {...props}
        >
          {emoji.emoji}
        </button>
      ),
    }),
    [columns],
  );

  return (
    <div id={id} ref={box} className="mt-2 overflow-hidden rounded-control border border-rule">
      {columns > 0 && (
        <EmojiPicker.Root
          locale="pt"
          emojibaseUrl={EMOJIBASE_URL}
          columns={columns}
          onEmojiSelect={({ emoji }) => onPick(emoji)}
          className="isolate flex h-72 flex-col bg-surface"
        >
          <div className="flex items-center gap-2 border-b border-rule p-2">
            <label className="relative flex min-w-0 flex-1 items-center">
              <MagnifyingGlassIcon size={18} aria-hidden className="pointer-events-none absolute left-2.5 text-ink-2" />
              <span className="sr-only">Buscar emoji</span>
              <EmojiPicker.Search
                placeholder="Buscar emoji"
                className="min-h-11 w-full min-w-0 appearance-none rounded-control bg-paper pr-2.5 pl-9 text-base outline-action focus-visible:outline-2"
              />
            </label>
            <EmojiPicker.SkinToneSelector
              aria-label="Mudar o tom de pele"
              title="Tom de pele"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-2xl hover:bg-action-soft"
            />
          </div>
          <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-ink-2">
              <CircleNotchIcon size={24} className="spinner" aria-hidden />
              <span className="sr-only">Carregando emojis…</span>
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">
              Nenhum emoji encontrado.
            </EmojiPicker.Empty>
            <EmojiPicker.List className="pb-1 select-none" components={components} />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      )}
    </div>
  );
}

/**
 * Paleta da moldura no jeito da do Office: uma coluna por cor, do claro ao escuro,
 * e qualquer outra cor pelo seletor do sistema.
 */
export function FramePalette({
  id,
  value,
  onChange,
}: {
  id: string;
  /** Cor atual em hex. */
  value: string;
  onChange: (hex: string) => void;
}) {
  // Cor que não está em nenhuma lista: veio do seletor do sistema
  const custom = !FRAME_PALETTE.some((row) => row.some((c) => c.hex === value)) && !BORDER_COLORS.some((c) => c.hex === value);
  return (
    <div id={id} className="mt-3 rounded-control border border-rule p-3">
      <div role="radiogroup" aria-label="Mais cores" className="grid grid-cols-10 gap-1 sm:max-w-sm">
        {FRAME_PALETTE.flatMap((row) =>
          row.map((c) => (
            <label
              key={c.hex}
              title={c.label}
              className={`relative aspect-square cursor-pointer rounded-[3px] ring-1 ring-ink/15 ring-inset has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-action ${
                value === c.hex ? "z-10 outline-2 outline-offset-1 outline-action" : ""
              }`}
              style={{ background: c.hex }}
            >
              <input
                type="radio"
                name="moldura-paleta"
                className="sr-only"
                checked={value === c.hex}
                onChange={() => onChange(c.hex)}
              />
              <span className="sr-only">{c.label}</span>
            </label>
          )),
        )}
      </div>
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className={`size-11 cursor-pointer rounded-control border-0 bg-transparent p-0 ${
            custom ? "outline-2 outline-offset-2 outline-action" : ""
          }`}
        />
        Outra cor
      </label>
    </div>
  );
}
