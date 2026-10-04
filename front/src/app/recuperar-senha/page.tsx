import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviamos um link para o seu e-mail."
      footer={
        <Link href="/entrar" className="font-bold text-action underline underline-offset-2">
          Voltar para o login
        </Link>
      }
    >
      <AuthForm mode="recuperar" />
    </AuthShell>
  );
}
