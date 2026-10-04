"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/** Erro no layout raiz: substitui a página inteira, sem os estilos do site. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (!error.digest) reportError("tela", error, { layout: "raiz" });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#f3f5f7", color: "#1b1f33", fontFamily: "system-ui, sans-serif" }}>
        <title>Algo deu errado | Fotoville</title>
        <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "6rem 1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Algo deu errado</h1>
          <p style={{ color: "#4e546a", fontSize: "1.125rem" }}>Tente de novo. Se continuar, fale com a gente.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1rem",
              minHeight: "44px",
              padding: "0 1.25rem",
              border: 0,
              borderRadius: "6px",
              background: "#4f5d9e",
              color: "#fcfdfe",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
