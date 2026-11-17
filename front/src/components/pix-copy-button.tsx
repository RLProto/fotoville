"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";

/** Copia o código Pix "copia e cola". Sem a API de área de transferência, cai no execCommand. */
export function PixCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const field = document.createElement("textarea");
      field.value = code;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-accent w-full sm:w-auto" aria-live="polite">
      {copied ? <CheckIcon size={18} aria-hidden /> : <CopyIcon size={18} aria-hidden />}
      {copied ? "Código copiado" : "Copiar código Pix"}
    </button>
  );
}
