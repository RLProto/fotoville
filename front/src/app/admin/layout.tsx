import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel da loja", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUser())) redirect("/entrar?proximo=/admin");
  const profile = await getProfile();
  if (!profile?.is_admin) notFound(); // quem não é da loja nem fica sabendo que a página existe
  return <div className="container-page py-8">{children}</div>;
}
