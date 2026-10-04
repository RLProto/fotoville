/**
 * Registra no banco (tabela error_logs) um erro que aconteceu no navegador do cliente.
 * Nunca lança e não espera resposta. O mesmo erro só vai uma vez por página, e no máximo 25 por página,
 * para um laço de erro não virar enxurrada.
 */
const sent = new Set<string>();

export function reportError(
  scope: string,
  error: unknown,
  detail?: Record<string, unknown>,
  level: "error" | "warning" = "error",
) {
  if (typeof window === "undefined") return;
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : String(error);
  const key = `${scope}|${message}|${JSON.stringify(detail ?? {}).slice(0, 300)}`;
  if (sent.has(key) || sent.size >= 25) return;
  sent.add(key);

  const body = JSON.stringify({
    scope,
    level,
    message: message.slice(0, 2000),
    url: (location.pathname + location.search).slice(0, 500),
    detail: {
      ...detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack.slice(0, 3000) } : {}),
    },
  });
  fetch("/api/erros", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => {},
  );
}

/** Dados do arquivo que ajudam a investigar falhas de envio. */
export function fileDetail(file: File) {
  return {
    file: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString(),
  };
}
