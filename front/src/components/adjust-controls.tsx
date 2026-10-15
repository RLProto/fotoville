"use client";

import { useId } from "react";

/** Controles de ajuste usados no editor de foto e na borda para todas as fotos. */

export function Slider({
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

export function Swatch({
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
