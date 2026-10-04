"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { whatsappLink } from "@/lib/site";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Erro do servidor (tem digest) já foi registrado lá, com mais detalhes; aqui só os do navegador.
    if (!error.digest) reportError("tela", error);
  }, [error]);

  return (
    <div className="container-page py-24 text-center">
      <h1 className="display text-4xl sm:text-5xl">Algo deu errado</h1>
      <p className="mt-3 text-lg text-ink-2">Tente de novo. Se continuar, fale com a gente.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Tentar de novo
        </button>
        <a href={whatsappLink("Olá, deu um erro no site.")} className="btn btn-outline">
          Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}
