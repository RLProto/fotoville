import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewAdminForm } from "@/components/admin/new-admin-form";
import { RemoveAdminButton } from "@/components/admin/remove-admin-button";
import { formatDate } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe" };

export default async function AdminEquipePage() {
  const me = await getProfile();
  if (!me?.is_admin) notFound();

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, is_super_admin")
    .eq("is_admin", true);

  const team = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      const email = data.user?.email ?? "";
      return {
        id: p.id,
        name: p.full_name || email || "Sem nome",
        email,
        isSuper: Boolean(p.is_super_admin),
        lastSignIn: data.user?.last_sign_in_at ?? null,
      };
    }),
  );
  team.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <h1 className="display-md text-3xl">Equipe</h1>
      <p className="mt-2 max-w-[62ch] text-ink-2">Quem tem acesso ao painel da loja.</p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left">
          <caption className="sr-only">Admins</caption>
          <thead className="border-b border-rule text-sm text-ink-2">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">
                Admin
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Último acesso
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {team.map((a) => (
              <tr key={a.id} className="border-b border-rule last:border-0 align-middle">
                <td className="px-4 py-3">
                  <span className="block font-semibold">
                    {a.name}
                    {a.id === me.id && <span className="badge ml-2 bg-paper text-ink-2">você</span>}
                  </span>
                  {a.email && a.email !== a.name && <span className="block text-sm break-all text-ink-2">{a.email}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{a.lastSignIn ? formatDate(a.lastSignIn) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {a.id !== me.id && !a.isSuper && <RemoveAdminButton userId={a.id} name={a.name} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 max-w-2xl">
        <NewAdminForm />
      </div>
    </>
  );
}
