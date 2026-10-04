import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTableEditor } from "@/components/admin/price-table-editor";
import { ProfileHeader } from "@/components/admin/profile-header";
import { getStoreProducts } from "@/lib/catalog";
import { minCopies, parseTiers } from "@/lib/pricing";
import { SIZE_GROUPS } from "@/lib/size-groups";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { PriceRow } from "@/lib/types";

export const metadata: Metadata = { title: "Perfil de cliente" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getProfile())?.is_admin) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const admin = createAdminClient();
  const [{ data: profile }, { data: rows }, { count }, products] = await Promise.all([
    admin.from("price_profiles").select("id, name").eq("id", id).maybeSingle(),
    admin.from("profile_prices").select("product_id, price_cents, price_tiers").eq("profile_id", id),
    admin.from("customer_price_profiles").select("user_id", { count: "exact", head: true }).eq("profile_id", id),
    getStoreProducts(),
  ]);
  if (!profile) notFound();

  const groups = SIZE_GROUPS.map((g) => ({
    title: g.title,
    items: products.filter(g.match).map((p) => ({ id: p.id, name: p.name, min: minCopies(p) })),
  })).filter((g) => g.items.length);
  const reference: Record<string, PriceRow> = Object.fromEntries(
    products.map((p) => [p.id, { product_id: p.id, price_cents: p.price_cents, price_tiers: p.price_tiers }]),
  );
  const initial: Record<string, PriceRow> = Object.fromEntries(
    (rows ?? []).map((r) => [r.product_id, { product_id: r.product_id, price_cents: r.price_cents, price_tiers: parseTiers(r.price_tiers) }]),
  );

  return (
    <>
      <p>
        <Link href="/admin/perfis" className="link text-sm">
          Todos os perfis
        </Link>
      </p>
      <div className="mt-3">
        <ProfileHeader id={profile.id} name={profile.name} customers={count ?? 0} />
      </div>
      <p className="mt-4 text-ink-2">
        {count ? (
          <Link href={`/admin/clientes?perfil=${profile.id}`} className="link">
            Ver os {count === 1 ? "clientes deste perfil (1)" : `${count} clientes deste perfil`}
          </Link>
        ) : (
          <>
            Nenhum cliente neste perfil ainda. Escolha em{" "}
            <Link href="/admin/clientes" className="link">
              Clientes
            </Link>
            .
          </>
        )}
      </p>

      <div className="mt-8">
        <PriceTableEditor
          groups={groups}
          initial={initial}
          reference={reference}
          saveUrl={`/api/admin/perfis/${profile.id}`}
          method="PATCH"
        />
      </div>
    </>
  );
}
