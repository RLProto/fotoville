"use client";

import { CircleNotchIcon, FileZipIcon, FolderOpenIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { askWrite, pickFolder, ZipFolder, type DirectoryHandle } from "@/lib/admin-download";

type Step = { kind: "failed"; again: boolean } | { kind: "confirm"; root: DirectoryHandle; denied: boolean };

/**
 * Escolha da pasta para baixar pedidos. Tenta o seletor normal; se nenhuma pasta for liberada, abre uma janela
 * com o caminho alternativo: escolhe a pasta só para leitura e pede a permissão de gravar num segundo clique.
 * Há Chrome que cancela sem aviso quando as duas coisas vêm juntas. Se nada disso der certo, a janela oferece
 * baixar em .zip (ZipFolder), que não depende do seletor de pasta.
 * `pick` resolve com a pasta pronta para gravar, ou null se a pessoa desistir.
 */
export function useFolderPicker() {
  const [step, setStep] = useState<Step | null>(null);
  const resolver = useRef<((root: DirectoryHandle | null) => void) | null>(null);

  async function pick(): Promise<DirectoryHandle | null> {
    const root = await pickFolder();
    if (root) return root;
    return new Promise((resolve) => {
      resolver.current = resolve;
      setStep({ kind: "failed", again: false });
    });
  }

  function finish(root: DirectoryHandle | null) {
    setStep(null);
    resolver.current?.(root);
    resolver.current = null;
  }

  const dialog = step && <FolderDialog key={step.kind} step={step} setStep={setStep} finish={finish} />;
  return { pick, dialog };
}

function FolderDialog({
  step,
  setStep,
  finish,
}: {
  step: Step;
  setStep: (step: Step) => void;
  finish: (root: DirectoryHandle | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function chooseAgain() {
    setBusy(true);
    const root = await pickFolder({ simple: true });
    setBusy(false);
    setStep(root ? { kind: "confirm", root, denied: false } : { kind: "failed", again: true });
  }

  async function allow(root: DirectoryHandle) {
    setBusy(true);
    const ok = await askWrite(root);
    setBusy(false);
    if (ok) finish(root);
    else setStep({ kind: "confirm", root, denied: true });
  }

  const spinner = busy && <CircleNotchIcon size={18} className="spinner" aria-hidden />;
  const title =
    step.kind === "failed"
      ? step.again
        ? "A pasta ainda não foi liberada"
        : "A pasta não foi liberada"
      : step.denied
        ? `O Chrome não permitiu salvar em “${step.root.name}”`
        : `Salvar as fotos em “${step.root.name}”?`;
  const text =
    step.kind === "failed"
      ? step.again
        ? "Baixe em .zip. Cada pedido vem num arquivo com as mesmas pastas."
        : "Baixe em .zip ou escolha a pasta de novo. Use uma pasta nova, como “Pedidos”."
      : step.denied
        ? "Baixe em .zip ou clique em Salvar aqui de novo e escolha Permitir."
        : "Quando o Chrome perguntar se o site pode editar os arquivos, clique em Permitir.";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pasta-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) finish(null);
      }}
      className="m-auto w-[min(100vw-1.5rem,26rem)] max-w-none rounded-panel bg-surface p-6 shadow-lift outline-none backdrop:bg-ink/70"
    >
      <h2 id="pasta-titulo" className="flex items-center gap-2 text-lg font-bold">
        {step.kind === "failed" || step.denied ? (
          <WarningCircleIcon size={24} weight="fill" aria-hidden className="shrink-0 text-danger" />
        ) : (
          <FolderOpenIcon size={24} weight="fill" aria-hidden className="shrink-0 text-action" />
        )}
        {title}
      </h2>
      <p className="mt-2 text-ink-2">{text}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => finish(null)}>
          Cancelar
        </button>
        {step.kind === "failed" ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={chooseAgain}>
            {spinner}
            Escolher pasta
          </button>
        ) : step.denied ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => allow(step.root)}>
            {spinner}
            Salvar aqui
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => allow(step.root)}>
            {spinner}
            Salvar aqui
          </button>
        )}
        {(step.kind === "failed" || step.denied) && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => finish(new ZipFolder())}>
            <FileZipIcon size={18} aria-hidden />
            Baixar .zip
          </button>
        )}
      </div>
    </dialog>
  );
}
