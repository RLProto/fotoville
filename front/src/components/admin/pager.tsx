"use client";

import { CaretDoubleLeftIcon, CaretDoubleRightIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";

/**
 * Paginação das listas do painel: primeira, anterior, "1–30 de 147", próxima e última. Navega por link
 * (`href`, página vinda do servidor) ou por clique (`onGo`, página feita no navegador).
 */
export function Pager({
  label,
  current,
  count,
  first,
  last,
  total,
  disabled = false,
  href,
  onGo,
}: {
  label: string;
  current: number;
  count: number;
  /** Posição do primeiro e do último item da página, e o total, para "1–30 de 147". */
  first: number;
  last: number;
  total: number;
  disabled?: boolean;
  href?: (page: number) => string;
  onGo?: (page: number) => void;
}) {
  if (count <= 1) return null;

  function step(to: number, text: string, icon: React.ReactNode, side: "left" | "right", iconOnly = false) {
    const off = disabled || to < 1 || to > count || to === current;
    const body = (
      <>
        {side === "left" && icon}
        {iconOnly ? <span className="sr-only">{text}</span> : text}
        {side === "right" && icon}
      </>
    );
    const className = `btn btn-outline btn-sm ${iconOnly ? "px-2.5" : ""}`;
    const title = iconOnly ? text : undefined;
    if (href) {
      return off ? (
        <span className={`${className} pointer-events-none opacity-50`} aria-disabled="true" title={title}>
          {body}
        </span>
      ) : (
        <Link href={href(to)} className={className} title={title}>
          {body}
        </Link>
      );
    }
    return (
      <button type="button" className={className} disabled={off} onClick={() => onGo?.(to)} title={title}>
        {body}
      </button>
    );
  }

  return (
    <nav aria-label={label} className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {step(1, "Primeira página", <CaretDoubleLeftIcon size={16} aria-hidden />, "left", true)}
      {step(current - 1, "Anterior", <CaretLeftIcon size={16} aria-hidden />, "left")}
      <p className="px-2 text-sm tabular-nums" aria-live="polite">
        {first}–{last} de {total}
      </p>
      {step(current + 1, "Próxima", <CaretRightIcon size={16} aria-hidden />, "right")}
      {step(count, "Última página", <CaretDoubleRightIcon size={16} aria-hidden />, "right", true)}
    </nav>
  );
}
