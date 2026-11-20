import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function NovaSenhaPage() {
  // Só chega aqui logado: pelo link de recuperação ou já dentro da conta.
  const user = await getUser();
  if (!user) redirect("/recuperar-senha");
  return (
    <AuthShell title="Nova senha" subtitle={user.email}>
      <AuthForm mode="nova-senha" account={user.email} />
    </AuthShell>
  );
}
