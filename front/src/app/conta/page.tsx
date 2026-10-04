import { CaretRightIcon, GearIcon, SignOutIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/order-status";
import { ProfileForm } from "@/components/profile-form";
import { formatBRL, formatDate } from "@/lib/format";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function ContaPage() {
  const user = await getUser();
  if (!user) redirect("/entrar?proximo=/conta");

  const supabase = await createClient();
  const [profile, { data: orders }] = await Promise.all([
    getProfile(),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const list = (orders ?? []) as Order[];

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-3xl sm:text-4xl">
            Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-ink-2">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.is_admin && (
            <Link href="/admin" className="btn btn-outline btn-sm">
              <GearIcon size={16} aria-hidden />
              Painel da loja
            </Link>
          )}
          <form action="/auth/sair" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">
              <SignOutIcon size={16} aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="pedidos">
          <h2 id="pedidos" className="text-2xl font-bold">
            Meus pedidos
          </h2>
          {list.length === 0 ? (
            <div className="card mt-4 p-8 text-center">
              <p className="text-lg text-ink-2">Você ainda não fez nenhum pedido.</p>
              <Link href="/enviar" className="btn btn-accent mt-4">
                Enviar fotos
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {list.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/pedido/${order.id}`}
                    className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow duration-200 hover:shadow-lift"
                  >
                    <div>
                      <p className="font-bold">
                        Pedido #{order.number}
                        <span className="font-normal text-ink-2">
                          {" "}
                          , {order.kind === "package" ? "Pacote de fotos" : "Revelação"}
                        </span>
                      </p>
                      <p className="text-sm text-ink-2">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={order.status} />
                      <span className="font-display font-bold tabular-nums">{formatBRL(order.total_cents)}</span>
                      <CaretRightIcon size={18} className="text-ink-2" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="dados">
            <h2 id="dados" className="mb-4 text-xl font-bold">
              Meus dados
            </h2>
            <ProfileForm
              userId={user.id}
              initial={{ name: profile?.full_name ?? "", whatsapp: profile?.whatsapp ?? "" }}
            />
            <Link href="/nova-senha" className="mt-4 inline-flex min-h-11 items-center font-semibold text-action underline underline-offset-2">
              Trocar senha
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
