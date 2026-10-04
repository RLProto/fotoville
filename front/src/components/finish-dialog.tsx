"use client";

import { useEffect, useRef } from "react";
import { FINISH_LABEL, type Finish } from "@/lib/types";

const FINISH_HINT: Record<Finish, string> = {
  brilho: "Cores mais vivas.",
  fosco: "Sem reflexo.",
};

/**
 * Escolha do acabamento no primeiro envio de fotos de um tamanho. Fechar sem escolher cancela.
 * O diálogo fecha antes de avisar a escolha: com ele aberto o resto da página fica inerte, e o
 * campo de arquivo não abriria a galeria.
 */
export function FinishDialog({
  finishes,
  onChoose,
  onCancel,
}: {
  finishes: Finish[];
  onChoose: (finish: Finish) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chosen = useRef(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => !chosen.current && onCancel()}
      aria-labelledby="acabamento-titulo"
      className="m-auto w-[min(100vw-1.5rem,28rem)] max-w-none rounded-panel bg-surface p-0 shadow-lift backdrop:bg-ink/70"
    >
      <div className="px-5 pt-5 pb-4">
        <h2 id="acabamento-titulo" className="text-lg font-bold">
          Qual acabamento?
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {finishes.map((finish) => (
            <button
              key={finish}
              type="button"
              onClick={() => {
                chosen.current = true;
                dialogRef.current?.close();
                onChoose(finish);
              }}
              className="rounded-panel border-[1.5px] border-rule px-4 py-5 text-left transition-colors hover:border-action hover:bg-action-soft"
            >
              <span className="block text-lg font-bold">{FINISH_LABEL[finish]}</span>
              <span className="mt-0.5 block text-sm text-ink-2">{FINISH_HINT[finish]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end border-t border-rule px-5 py-3">
        <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
