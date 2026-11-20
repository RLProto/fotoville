import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default async function RecuperarSenhaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Você recebe um link para criar uma nova senha."
      footer={
        <p>
          Lembrou a senha?{" "}
          <Link href="/entrar" className="inline-flex min-h-11 items-center font-bold text-action underline underline-offset-2">
            Entrar
          </Link>
        </p>
      }
    >
      {erro === "link" && (
        <p className="alert alert-danger mb-4" role="alert">
          Este link expirou ou já foi usado. Peça outro.
        </p>
      )}
      <AuthForm mode="recuperar" />
    </AuthShell>
  );
}
