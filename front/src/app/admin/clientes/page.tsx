import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerProfileSelect } from "@/components/admin/customer-profile-select";
import { formatBRL, formatDate, formatPhone } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Clientes" };

const PAID: OrderStatus[] = ["paid", "in_production", "shipped", "ready_for_pickup", "delivered"];
const LIMIT = 200;

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; perfil?: string }>;
}) {
  if (!(await getProfile())?.is_admin) notFound();
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const perfil = params.perfil ?? "";

  const admin = createAdminClient();
  const [{ data: users }, { data: profiles }, { data: links }, { data: priceProfiles }, { data: orders }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, full_name, whatsapp, is_admin"),
    admin.from("customer_price_profiles").select("user_id, profile_id"),
    admin.from("price_profiles").select("id, name").order("created_at"),
    admin.from("orders").select("user_id, status, total_cents, created_at").in("status", PAID).limit(10000),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const profileOf = new Map((links ?? []).map((l) => [l.user_id, l.profile_id]));
  const stats = new Map<string, { count: number; spent: number; last: string }>();
  for (const o of orders ?? []) {
    const s = stats.get(o.user_id) ?? { count: 0, spent: 0, last: o.created_at };
    s.count += 1;
    s.spent += o.total_cents;
    if (o.created_at > s.last) s.last = o.created_at;
    stats.set(o.user_id, s);
  }

  const all = (users?.users ?? [])
    .map((u) => {
      const p = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        name: p?.full_name || u.email || "Sem nome",
        whatsapp: p?.whatsapp ?? null,
        isAdmin: Boolean(p?.is_admin),
        profileId: profileOf.get(u.id) ?? null,
        ...(stats.get(u.id) ?? { count: 0, spent: 0, last: null as string | null }),
      };
    })
    // Quem mais compra primeiro: é onde estão os clientes assíduos
    .sort((a, b) => b.count - a.count || b.spent - a.spent || a.name.localeCompare(b.name, "pt-BR"));

  const filtered = all.filter((c) => {
    if (perfil === "sem" && c.profileId) return false;
    if (perfil && perfil !== "sem" && c.profileId !== perfil) return false;
    if (!q) return true;
    return [c.name, c.email, c.whatsapp ?? ""].some((v) => v.toLowerCase().includes(q));
  });
  const shown = filtered.slice(0, LIMIT);
  const options = priceProfiles ?? [];

  return (
    <>
      <h1 className="display-md text-3xl">Clientes</h1>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        Escolha o perfil de cada cliente. A tabela do perfil passa a valer no próximo carregamento de página dele.
        {options.length === 0 && (
          <>
            {" "}
            Primeiro crie um perfil em{" "}
            <Link href="/admin/perfis" className="link">
              Perfis
            </Link>
            .
          </>
        )}
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="busca-cliente" className="field-label">
            Buscar
          </label>
          <input
            id="busca-cliente"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Nome, e-mail ou WhatsApp"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="filtro-perfil" className="field-label">
            Perfil
          </label>
          <select id="filtro-perfil" name="perfil" defaultValue={perfil} className="field-input w-auto">
            <option value="">Todos</option>
            <option value="sem">Tabela da loja</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline">
          Filtrar
        </button>
        {(q || perfil) && (
          <Link href="/admin/clientes" className="btn btn-ghost">
            Limpar
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-ink-2">
        {filtered.length === 1 ? "1 cliente" : `${filtered.length} clientes`}
        {filtered.length > LIMIT && `, mostrando os ${LIMIT} que mais compram`}.
      </p>

      {shown.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-lg text-ink-2">Nenhum cliente encontrado.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left">
            <caption className="sr-only">Clientes</caption>
            <thead className="border-b border-rule text-sm text-ink-2">
              <tr>
                {["Cliente", "WhatsApp", "Pedidos pagos", "Total", "Último pedido", "Perfil de preço"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b border-rule last:border-0 align-middle">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">
                      {c.name}
                      {c.isAdmin && <span className="badge ml-2 bg-paper text-ink-2">loja</span>}
                    </span>
                    {c.email && c.email !== c.name && <span className="block text-sm break-all text-ink-2">{c.email}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.whatsapp ? formatPhone(c.whatsapp) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{c.count}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.spent ? formatBRL(c.spent) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.last ? formatDate(c.last) : "—"}</td>
                  <td className="px-4 py-3">
                    <CustomerProfileSelect userId={c.id} customerName={c.name} value={c.profileId} profiles={options} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
