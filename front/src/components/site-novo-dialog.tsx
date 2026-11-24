"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const KEY = "fotoville:aviso-site-novo";

/**
 * Aviso na tela Entrar: as contas do site antigo não vieram para este.
 * Aparece uma vez por navegador; fechado de qualquer jeito, não volta.
 */
export function SiteNovoDialog({ cadastroHref }: { cadastroHref: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      // Sem acesso ao armazenamento: mostra mesmo assim.
    }
    dialogRef.current?.showModal();
  }, []);

  function remember() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Sem acesso ao armazenamento: o aviso volta na próxima visita.
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="site-novo-titulo"
      aria-describedby="site-novo-texto"
      onClose={remember}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      className="m-auto w-[min(100vw-1.5rem,26rem)] max-w-none rounded-panel bg-surface p-6 shadow-lift outline-none backdrop:bg-ink/70"
    >
      <h2 id="site-novo-titulo" className="display-md text-2xl">
        A Fotoville está de cara nova
      </h2>
      <p id="site-novo-texto" className="mt-3 text-lg text-ink-2">
        Os cadastros do site antigo não foram transferidos. Se você ainda não se cadastrou aqui, crie sua conta.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Link href={cadastroHref} onClick={remember} className="btn btn-accent">
          Criar conta
        </Link>
        <button type="button" onClick={() => dialogRef.current?.close()} className="btn btn-outline">
          Já tenho cadastro
        </button>
      </div>
    </dialog>
  );
}
