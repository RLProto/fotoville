"use client";

import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

export type DownloadState =
  | { phase: "running"; title: string; done: number; total: number }
  | { phase: "finished"; ok: boolean; title: string; text: string };

/** Como terminou: quantos pedidos foram salvos e os números dos que falharam. */
export function downloadResult(saved: number, failed: number[]): DownloadState {
  if (!failed.length) {
    return saved === 1
      ? { phase: "finished", ok: true, title: "Pedido salvo", text: "Etiqueta disponível para impressão." }
      : { phase: "finished", ok: true, title: `${saved} pedidos salvos`, text: "Etiquetas disponíveis para impressão." };
  }
  if (!saved) {
    return {
      phase: "finished",
      ok: false,
      title: failed.length === 1 ? "Não foi possível salvar o pedido" : "Não foi possível salvar os pedidos",
      text: "Tente de novo.",
    };
  }
  return {
    phase: "finished",
    ok: false,
    title: `${saved} de ${saved + failed.length} pedidos salvos`,
    text: `Faltou ${failed.map((n) => `#${n}`).join(", ")}. Tente de novo.`,
  };
}

/** Andamento do download das fotos. Enquanto grava, não fecha: sair da aba interromperia o download. */
export function DownloadDialog({ state, onClose }: { state: DownloadState; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const finished = state.phase === "finished";

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  useEffect(() => {
    if (finished) closeRef.current?.focus();
  }, [finished]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="download-titulo"
      onCancel={(e) => {
        if (!finished) e.preventDefault();
      }}
      onClose={onClose}
      className="m-auto w-[min(100vw-1.5rem,26rem)] max-w-none rounded-panel bg-surface p-6 shadow-lift outline-none backdrop:bg-ink/70"
    >
      {state.phase === "running" ? (
        <>
          <h2 id="download-titulo" className="text-lg font-bold">
            {state.title}
          </h2>
          {/* Sem total ainda (buscando as fotos): a barra corre sem número */}
          <div
            role="progressbar"
            aria-labelledby="download-titulo"
            aria-valuemin={0}
            aria-valuemax={state.total || undefined}
            aria-valuenow={state.total ? state.done : undefined}
            className="mt-4 h-2 overflow-hidden rounded-full bg-paper"
          >
            <div
              className={`h-full rounded-full bg-action transition-[width] duration-200 ${state.total ? "" : "animate-pulse"}`}
              style={{ width: state.total ? `${(state.done / state.total) * 100}%` : "100%" }}
            />
          </div>
          <p className="mt-2 flex justify-between gap-4 text-sm text-ink-2">
            <span className="tabular-nums">{state.total ? `${state.done} de ${state.total} fotos` : "Preparando…"}</span>
            <span>Mantenha esta aba aberta.</span>
          </p>
        </>
      ) : (
        <div role="status">
          <h2 id="download-titulo" className="flex items-center gap-2 text-lg font-bold">
            {state.ok ? (
              <CheckCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-success" />
            ) : (
              <WarningCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-danger" />
            )}
            {state.title}
          </h2>
          <p className="mt-2 text-ink-2">{state.text}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={closeRef} type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              Fechar
            </button>
            {state.ok && (
              <Link href="/admin/etiquetas" className="btn btn-primary">
                Ver etiquetas
              </Link>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
