"use client";

import { WhatsappLogoIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/site";

/** Telas de tarefa com ação fixa embaixo: lá o WhatsApp fica dentro do resumo, não flutuando sobre os botões. */
const HIDDEN = ["/enviar", "/carrinho", "/checkout", "/admin"];

export function WhatsAppButton() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  // Na home, o botão espera a pessoa rolar: no topo ele cobria o "Ver preços" no celular
  useEffect(() => {
    if (!home) return;
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [home]);

  // /enviar (escolha do tamanho) já é a etapa 1 do pedido: lá o botão cobria a coluna de preços
  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (home && !scrolled) return null;

  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Fotoville pelo WhatsApp"
      className="fixed right-4 bottom-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#128c4b] text-white shadow-lift transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 print:hidden"
    >
      <WhatsappLogoIcon size={30} weight="fill" aria-hidden />
    </a>
  );
}
