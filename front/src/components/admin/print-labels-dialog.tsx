"use client";

import { CheckCircleIcon, CircleNotchIcon, PrinterIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { DownloadTarget } from "@/components/admin/use-order-downloads";
import { plural } from "@/lib/format";
import type { BatchView } from "@/lib/label-batches";
import { LABEL_SHEET, LABELS_PER_SHEET } from "@/lib/order-label";
import { reportError } from "@/lib/report-error";

export type PrintJob = {
  batch: BatchView;
  /** PDF das etiquetas (blob:), liberado por quem abriu a janela depois que ela fecha. */
  url: string;
  labels: number;
  /** Navegador sem leitor de PDF embutido (celular): o PDF abriu em outra aba. */
  external: boolean;
};

type Step = "preview" | "saving" | "done" | "failed";

/**
 * Prévia do PDF do lote e impressão. O clique em Imprimir abre a impressão do navegador e marca o lote como
 * impresso (os aprovados passam para "Em produção"); depois, a mesma janela pergunta se baixa as fotos.
 * A prévia não sai da tela até a janela fechar: tirar o PDF da página pode cancelar a impressão aberta.
 */
export function PrintLabelsDialog({
  job,
  canPickFolder,
  onPrinted,
  onDownload,
  onClose,
}: {
  job: PrintJob;
  canPickFolder: boolean;
  onPrinted: () => void;
  onDownload: (orders: DownloadTarget[]) => void;
  onClose: () => void;
}) {
  const { batch, url, labels, external } = job;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [step, setStep] = useState<Step>("preview");
  const [moved, setMoved] = useState(0);
  const [loaded, setLoaded] = useState(external);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Há navegador que não avisa quando o PDF termina de carregar: o botão não fica preso por isso
    const timer = setTimeout(() => setLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Só o que ainda não foi baixado entra na pergunta. Depois de impresso, quem estava aprovado já está em produção.
  const pending: DownloadTarget[] = batch.orders
    .filter((o) => o.downloadable && !o.downloaded)
    .map((o) => ({ id: o.id, number: o.number, status: o.status === "paid" ? "in_production" : o.status }));
  const sheets = Math.ceil(labels / LABELS_PER_SHEET);
  const close = () => dialogRef.current?.close();

  async function markPrinted() {
    setStep("saving");
    const res = await fetch(`/api/admin/etiquetas/${batch.id}/imprimir`, { method: "POST" }).catch(() => null);
    const body: { moved?: number } | null = res?.ok ? await res.json().catch(() => null) : null;
    if (typeof body?.moved !== "number") {
      if (!res) reportError("loja", new Error("Sem conexão ao marcar o lote como impresso"), { lote: batch.id });
      setStep("failed");
      return;
    }
    setMoved(body.moved);
    setStep("done");
    onPrinted();
  }

  function print() {
    // Antes de qualquer espera: a impressão precisa abrir como resposta ao clique
    let opened = false;
    try {
      const win = frameRef.current?.contentWindow;
      if (win) {
        win.focus();
        win.print();
        opened = true;
      }
    } catch (err) {
      reportError("loja", err, { etapa: "imprimir etiquetas", lote: batch.id }, "warning");
    }
    if (!opened) window.open(url, "_blank");
    markPrinted();
  }

  const finished = step === "done" || step === "failed";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="impressao-titulo"
      aria-describedby="impressao-detalhe"
      onCancel={(e) => {
        if (step === "saving") e.preventDefault();
      }}
      onClose={onClose}
      className="m-auto h-[min(100dvh-1.5rem,54rem)] w-[min(100vw-1.5rem,60rem)] max-w-none flex-col overflow-hidden rounded-panel bg-surface p-0 shadow-lift outline-none backdrop:bg-ink/70 open:flex"
    >
      <header className="border-b border-rule px-5 py-4 sm:px-6">
        <h2 id="impressao-titulo" className="text-lg font-bold">
          Lote {batch.number}
        </h2>
        <p id="impressao-detalhe" className="text-sm text-ink-2">
          {plural(labels, "etiqueta", "etiquetas")}, {plural(sheets, "folha", "folhas")}
        </p>
      </header>

      <div className="relative min-h-0 flex-1 bg-paper">
        {external ? (
          <div className="grid h-full place-content-center gap-3 p-6 text-center">
            <p className="text-ink-2">O PDF abriu em outra aba.</p>
            <a href={url} target="_blank" rel="noopener" className="link font-semibold">
              Abrir o PDF de novo
            </a>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title={`Etiquetas do lote ${batch.number}`}
            onLoad={() => setLoaded(true)}
            className="block h-full w-full"
          />
        )}

        {/* Por cima da prévia, sem tirá-la da página */}
        {finished && (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-surface/85 p-4 backdrop-blur-[2px]">
            <div role="status" className="card w-full max-w-[26rem] p-6 shadow-lift">
              {step === "failed" ? (
                <>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <WarningCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-danger" />
                    Os pedidos não mudaram de status
                  </h3>
                  <p className="mt-2 text-ink-2">
                    As etiquetas abriram, mas o lote não foi marcado como impresso. Tente de novo.
                  </p>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" className="btn btn-outline" onClick={close}>
                      Fechar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={markPrinted} autoFocus>
                      Tentar de novo
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <CheckCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-success" />
                    {moved ? `${plural(moved, "pedido", "pedidos")} em produção` : `Lote ${batch.number} impresso`}
                  </h3>
                  {pending.length > 0 && canPickFolder ? (
                    <>
                      <p className="mt-3 font-semibold">
                        Baixar as fotos {pending.length === 1 ? "do pedido" : `dos ${pending.length} pedidos`} agora?
                      </p>
                      <p className="mt-1 text-sm text-ink-2">
                        {pending.length === 1
                          ? "As fotos ficam separadas por tamanho."
                          : "Uma pasta por pedido, com as fotos separadas por tamanho."}
                      </p>
                      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" className="btn btn-outline" onClick={close}>
                          Agora não
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => onDownload(pending)} autoFocus>
                          Baixar fotos
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {pending.length > 0 && (
                        <p className="mt-2 text-ink-2">
                          Para baixar as fotos em pastas, abra o painel no Chrome ou no Edge do computador.
                        </p>
                      )}
                      <div className="mt-5 flex justify-end">
                        <button type="button" className="btn btn-outline" onClick={close} autoFocus>
                          Fechar
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-2">
          Folha Pimaco {LABEL_SHEET.name}. Na impressão, deixe a escala em 100%.
        </p>
        {/* Depois de imprimir, as ações ficam na pergunta por cima da prévia */}
        <div className={`flex flex-col-reverse gap-2 sm:flex-row ${finished ? "hidden" : ""}`}>
          <button type="button" className="btn btn-outline" disabled={step === "saving"} onClick={close}>
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!loaded || step !== "preview"}
            onClick={external ? markPrinted : print}
          >
            {step === "saving" ? (
              <CircleNotchIcon size={18} className="spinner" aria-hidden />
            ) : (
              <PrinterIcon size={18} aria-hidden />
            )}
            {external ? "Marcar como impresso" : "Imprimir"}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
