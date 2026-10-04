import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { createAdminClient, getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel da loja", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUser())) redirect("/entrar?proximo=/admin");
  const profile = await getProfile();
  if (!profile?.is_admin) notFound(); // quem não é da loja nem fica sabendo que a página existe

  // Erros em aberto do site publicado, para a aba "Erros"
  const { count } = await createAdminClient()
    .from("error_logs")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null)
    .eq("env", "production");

  return (
    <div className="container-page py-8">
      <AdminNav openErrors={count ?? 0} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
