import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell, safeNext } from "@/components/auth-shell";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.proximo);
  // Já logado: segue direto para onde ia, em vez de mostrar o formulário de novo.
  if (await getUser()) redirect(next);
  return (
    <AuthShell
      title="Entrar"
      footer={
        <p>
          Ainda não tem conta?{" "}
          <Link
            href={`/cadastro?proximo=${encodeURIComponent(next)}`}
            className="font-bold text-action underline underline-offset-2"
          >
            Criar conta
          </Link>
        </p>
      }
    >
      {params.erro && (
        <p className="alert alert-danger mb-4" role="alert">
          O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.
        </p>
      )}
      <AuthForm mode="entrar" next={next} />
    </AuthShell>
  );
}
