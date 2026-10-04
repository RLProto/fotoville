import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Você recebe um link para criar uma nova senha."
      footer={
        <p>
          Lembrou a senha?{" "}
          <Link href="/entrar" className="font-bold text-action underline underline-offset-2">
            Entrar
          </Link>
        </p>
      }
    >
      <AuthForm mode="recuperar" />
    </AuthShell>
  );
}
