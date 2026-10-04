import type { Instrumentation } from "next";

/** Erros não tratados no servidor (páginas, rotas de API e ações) vão para a tabela error_logs. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { describeError, logError } = await import("./lib/error-log");
  const { message, stack } = describeError(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const userAgent = request.headers["user-agent"];
  await logError({
    source: "server",
    scope: { render: "pagina", route: "api", action: "acao", proxy: "proxy" }[context.routeType] ?? context.routeType,
    message,
    url: request.path,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    detail: { method: request.method, routePath: context.routePath, digest, stack },
  });
};
