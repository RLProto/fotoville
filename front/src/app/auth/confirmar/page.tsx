import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ConfirmLinkForm, InvalidLink } from "@/components/confirm-link-form";
import { isConfirmType } from "@/lib/auth-links";

export const metadata: Metadata = { title: "Confirmar", robots: { index: false } };

/**
 * Destino dos links de e-mail (recuperação de senha e confirmação de cadastro). Abrir a página não gasta o
 * link: só o botão confere o token. Assim, o leitor de e-mail ou o antivírus que abre o link antes do cliente
 * não o deixa "já usado", e o link funciona em qualquer aparelho, não só no navegador que pediu.
 */
export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const confirmType = tokenHash && isConfirmType(type) ? type : null;
  const recovery = type === "recovery";

  return (
    <AuthShell title={recovery ? "Criar nova senha" : "Confirmar e-mail"}>
      {confirmType ? (
        <ConfirmLinkForm tokenHash={tokenHash!} type={confirmType} next={next ?? ""} />
      ) : (
        <InvalidLink recovery={recovery} />
      )}
    </AuthShell>
  );
}
