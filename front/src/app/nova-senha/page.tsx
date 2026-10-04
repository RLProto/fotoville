import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NovaSenhaPage() {
  // Só chega aqui logado: pelo link de recuperação ou já dentro da conta.
  if (!(await getUser())) redirect("/recuperar-senha");
  return (
    <AuthShell title="Nova senha">
      <AuthForm mode="nova-senha" />
    </AuthShell>
  );
}
