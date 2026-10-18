import { hasSupabase } from "@/lib/site";

export { safeNext } from "@/lib/safe-next";

/** Por que a conta é pedida agora, conforme o destino depois do acesso. */
export function accessReason(next: string) {
  if (next.startsWith("/enviar/")) return "Para guardar suas fotos enquanto você monta o pedido.";
  if (next.startsWith("/promocoes")) return "Para comprar o pacote e receber o cupom.";
  if (next.startsWith("/carrinho") || next.startsWith("/checkout")) return "Para ver e finalizar seu pedido.";
  return undefined;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-md">
        <h1 className="display-md text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-ink-2">{subtitle}</p>}
        <div className="card mt-6 p-6">
          {hasSupabase ? (
            children
          ) : (
            <p className="alert alert-warning">
              O banco de dados ainda não foi configurado neste ambiente. Preencha o arquivo .env.local para liberar
              login e cadastro.
            </p>
          )}
        </div>
        {footer && <div className="mt-5 text-center">{footer}</div>}
      </div>
    </div>
  );
}
