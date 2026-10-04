import { reportError } from "./lib/report-error";

// Erros inesperados no navegador do cliente vão para a tabela error_logs.
// Ficam de fora os que não são do site: extensões, scripts de outros domínios e avisos do próprio navegador.
const ignored = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:/;

window.addEventListener("error", (event) => {
  try {
    const message = event.error instanceof Error ? `${event.error.name}: ${event.error.message}` : event.message;
    if (!message || ignored.test(message)) return;
    if (event.filename && !event.filename.startsWith(location.origin)) return;
    reportError("inesperado", event.error ?? message, { line: event.lineno, column: event.colno, file: event.filename });
  } catch {}
});

window.addEventListener("unhandledrejection", (event) => {
  try {
    const reason = event.reason;
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    const text = reason instanceof Error ? `${reason.name}: ${reason.message} ${reason.stack ?? ""}` : String(reason);
    if (ignored.test(text)) return;
    reportError("inesperado", reason instanceof Error ? reason : text, { kind: "promessa sem tratamento" });
  } catch {}
});
