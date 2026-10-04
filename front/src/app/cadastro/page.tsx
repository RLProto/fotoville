import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell, safeNext } from "@/components/auth-shell";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const next = safeNext((await searchParams).proximo);
  if (await getUser()) redirect(next);
  return (
    <AuthShell
      title="Criar conta"
      footer={
        <p>
          Já tem conta?{" "}
          <Link
            href={`/entrar?proximo=${encodeURIComponent(next)}`}
            className="font-bold text-action underline underline-offset-2"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <AuthForm mode="cadastro" next={next} />
    </AuthShell>
  );
}
