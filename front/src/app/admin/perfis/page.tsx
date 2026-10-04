import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewProfileForm } from "@/components/admin/new-profile-form";
import { formatDate, plural } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfis de cliente" };

export default async function AdminPerfisPage() {
  if (!(await getProfile())?.is_admin) notFound();

  const admin = createAdminClient();
  const [{ data: profiles, error }, { data: links }] = await Promise.all([
    admin.from("price_profiles").select("id, name, created_at").order("created_at"),
    admin.from("customer_price_profiles").select("profile_id"),
  ]);
  const customers = new Map<string, number>();
  for (const l of links ?? []) customers.set(l.profile_id, (customers.get(l.profile_id) ?? 0) + 1);
  const list = profiles ?? [];

  return (
    <>
      <h1 className="display-md text-3xl">Perfis de cliente</h1>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        Cada perfil tem a própria tabela de preços. O cliente com perfil vê e paga essa tabela em todo o site, com o
        preço da loja riscado ao lado. O perfil de cada cliente se escolhe em{" "}
        <Link href="/admin/clientes" className="link">
          Clientes
        </Link>
        .
      </p>

      {error && <p className="alert alert-danger mt-6">Erro ao carregar os perfis: {error.message}</p>}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="lista-perfis">
          <h2 id="lista-perfis" className="sr-only">
            Perfis
          </h2>
          {list.length === 0 ? (
            <p className="card p-8 text-center text-lg text-ink-2">Nenhum perfil ainda.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/perfis/${p.id}`}
                    className="card flex items-center justify-between gap-4 p-4 transition-colors duration-150 hover:border-action"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold">{p.name}</span>
                      <span className="block text-sm text-ink-2">
                        {plural(customers.get(p.id) ?? 0, "cliente", "clientes")}, criado em {formatDate(p.created_at)}
                      </span>
                    </span>
                    <CaretRightIcon size={18} className="shrink-0 text-ink-2" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <NewProfileForm suggestedName={`Perfil ${list.length + 1}`} />
      </div>
    </>
  );
}
