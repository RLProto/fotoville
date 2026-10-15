import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { createAdminClient, getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel da loja", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUser())) redirect("/entrar?proximo=/admin");
  const profile = await getProfile();
  if (!profile?.is_admin) notFound(); // quem não é da loja nem fica sabendo que a página existe

  // Erros em aberto do site publicado, para a aba "Erros" (só o super admin vê)
  const openErrors = profile.is_super_admin
    ? ((
        await createAdminClient()
          .from("error_logs")
          .select("id", { count: "exact", head: true })
          .is("resolved_at", null)
          .eq("env", "production")
      ).count ?? 0)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6">
      <AdminNav openErrors={openErrors} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
