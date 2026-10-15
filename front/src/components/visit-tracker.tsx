"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Avisa o servidor a cada página aberta no site (fora do painel), para a aba Estatísticas. */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (!navigator.sendBeacon?.("/api/visita", new Blob([body], { type: "application/json" }))) {
        fetch("/api/visita", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      // sem rede ou bloqueado: a visita não conta
    }
  }, [pathname]);
  return null;
}
