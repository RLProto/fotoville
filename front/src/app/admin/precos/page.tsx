import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTableEditor } from "@/components/admin/price-table-editor";
import { getStoreProducts } from "@/lib/catalog";
import { minCopies } from "@/lib/pricing";
import { SIZE_GROUPS } from "@/lib/size-groups";
import { getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Preços da loja" };

export default async function AdminPrecosPage() {
  if (!(await getProfile())?.is_admin) notFound();

  const products = await getStoreProducts();
  const groups = SIZE_GROUPS.map((g) => ({
    title: g.title,
    items: products.filter(g.match).map((p) => ({ id: p.id, name: p.name, min: minCopies(p) })),
  })).filter((g) => g.items.length);
  const initial = Object.fromEntries(
    products.map((p) => [p.id, { product_id: p.id, price_cents: p.price_cents, price_tiers: p.price_tiers }]),
  );

  return (
    <>
      <h1 className="display-md text-3xl">Preços da loja</h1>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        Valem para todos os clientes sem perfil. Clientes com perfil pagam a tabela do perfil, em{" "}
        <Link href="/admin/perfis" className="link">
          Perfis
        </Link>
        .
      </p>
      <div className="mt-8">
        <PriceTableEditor groups={groups} initial={initial} saveUrl="/api/admin/precos" method="PUT" />
      </div>
    </>
  );
}
