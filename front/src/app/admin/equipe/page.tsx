import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RemoveAdminButton } from "@/components/admin/remove-admin-button";
import { UserSearch } from "@/components/admin/user-search";
import { listAllUsers } from "@/lib/admin-team";
import { formatDate } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe" };

export default async function AdminEquipePage() {
  const me = await getProfile();
  if (!me?.is_admin) notFound();

  const [users, { data: profiles }] = await Promise.all([
    listAllUsers(),
    createAdminClient().from("profiles").select("id, full_name, is_admin, is_super_admin"),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const all = users
    .map((u) => {
      const p = byId.get(u.id);
      const email = u.email ?? "";
      return {
        id: u.id,
        name: p?.full_name || email || "Sem nome",
        email,
        isAdmin: Boolean(p?.is_admin),
        isSuper: Boolean(p?.is_super_admin),
        lastSignIn: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const team = all.filter((u) => u.isAdmin);
  const candidates = all.filter((u) => !u.isAdmin).map(({ id, name, email }) => ({ id, name, email }));

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

      <div className="mt-6 max-w-3xl">
        <UserSearch users={candidates} />
      </div>
    </>
  );
}
