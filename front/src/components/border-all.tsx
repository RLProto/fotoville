"use client";

import { CircleNotchIcon, ProhibitIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Slider, Swatch } from "@/components/adjust-controls";
import { BORDER_COLORS, BORDER_MM } from "@/lib/adjust";
import type { Adjust, BorderColor } from "@/lib/types";

/**
 * Painel da borda para todas as fotos de uma vez, aberto pelo botão "Borda" da barra do envio,
 * com as mesmas cores e espessura do editor. "Aplicar a todas" grava a borda em cada foto;
 * "Sem borda" tira de todas.
 */
export function BorderAll({
  current,
  busy,
  onApply,
  onClose,
}: {
  /** Borda que todas as fotos já têm em comum, se houver. */
  current: Adjust["border"];
  busy: boolean;
  onApply: (border: Adjust["border"]) => Promise<void>;
  onClose: () => void;
}) {
  const [color, setColor] = useState<BorderColor | null>(current?.color ?? "branco");
  const [mm, setMm] = useState(current?.mm ?? BORDER_MM.initial);

  async function apply() {
    await onApply(color ? { color, mm } : null);
    onClose();
  }

  return (
    <div id="borda-todas" className="card mt-4 p-4" role="group" aria-label="Borda para todas as fotos">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <fieldset className="min-w-0">
          <legend className="field-label">Cor da borda, em todas as fotos</legend>
          <div className="flex flex-wrap gap-2">
            <Swatch
              name="borda-todas"
              label="Sem borda"
              checked={color === null}
              onChange={() => setColor(null)}
              className="bg-surface text-ink-2"
            >
              <ProhibitIcon size={20} aria-hidden />
            </Swatch>
            {BORDER_COLORS.map((c) => (
              <Swatch
                key={c.id}
                name="borda-todas"
                label={c.label}
                checked={color === c.id}
                onChange={() => setColor(c.id)}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </fieldset>
        {color && (
          <div className="w-full max-w-sm">
            <Slider
              label="Espessura"
              value={mm}
              min={BORDER_MM.min}
              max={BORDER_MM.max}
              format={(v) => `${v} mm`}
              onChange={setMm}
            />
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={apply} disabled={busy}>
          {busy && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          {color ? "Aplicar a todas" : "Tirar a borda de todas"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Fechar
        </button>
      </div>
    </div>
  );
}
