"use client";

import { useState } from "react";

export const MAX_COPIES = 10000;

/**
 * Número de cópias digitável (1 a 10.000). Grava ao sair do campo ou com Enter;
 * texto inválido volta ao valor anterior. Use `key={value}` para acompanhar mudanças de fora (+ e −).
 */
export function CopiesInput({
  id,
  value,
  label,
  onCommit,
  className = "",
}: {
  id?: string;
  value: number;
  label: string;
  onCommit: (n: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(value));

  function commit() {
    const n = Math.min(MAX_COPIES, Math.max(1, Number.parseInt(text, 10) || value));
    setText(String(n));
    if (n !== value) onCommit(n);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 5))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      // O contorno de foco do site, por dentro do campo (por fora ele encostaria nos botões + e −)
      className={`min-w-0 bg-transparent text-center font-bold tabular-nums focus:bg-action-soft focus-visible:-outline-offset-3 ${className}`}
    />
  );
}
