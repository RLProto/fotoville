import type { Metadata } from "next";
import Link from "next/link";
import { PackageCard } from "@/components/package-card";
import { PageHeader } from "@/components/page-header";
import { getPackages, getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Pacotes de fotos 10x15",
  description:
    "Pacotes pré-pagos de 100 a 1000 fotos 10x15 com até 55% de desconto. O saldo vale para vários pedidos. Frete à parte.",
};

export default async function PromocoesPage() {
  const [packages, products] = await Promise.all([getPackages(), getProducts()]);
  const regular = products.find((p) => p.id === "10x15")?.price_cents ?? 0;
  const bestDiscount = regular
    ? Math.max(...packages.map((p) => Math.round((1 - p.price_cents / p.photo_count / regular) * 100)))
    : 0;

  return (
    <>
      <PageHeader title="Compre agora, revele depois">
        {bestDiscount > 0 && <p>Pacotes de fotos 10x15 com até {bestDiscount}% de desconto.</p>}
      </PageHeader>

      <section
        className="bg-blade-mustard"
        aria-label="Pacotes"
        style={{ ["--perforation-bg" as string]: "var(--color-blade-mustard)" }}
      >
        <div className="container-page grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} regularUnitCents={regular} />
          ))}
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="como-usar">
        <h2 id="como-usar" className="display-md text-2xl">
          Como usar
        </h2>
        <p className="mt-3 max-w-[60ch] text-lg text-ink-2">
          Depois do pagamento, o código do cupom aparece na página do pedido. Informe o cupom ao pagar pedidos de fotos
          10x15 até acabar o saldo.
        </p>
        <p className="mt-8 text-ink-2">
          Frete à parte.{" "}
          <Link href="/prazos-e-frete" className="link">
            Consultar prazos e frete
          </Link>
        </p>
      </section>
    </>
  );
}
