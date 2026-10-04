import type { Metadata } from "next";
import Link from "next/link";
import { PackageCard } from "@/components/package-card";
import { PageHeader } from "@/components/page-header";
import { getPackages, getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Promoções: pacotes de fotos 10x15",
  description:
    "Pacotes de 100 a 1000 fotos 10x15 com desconto. Compre agora e revele quando quiser, usando seu cupom.",
};

const HOW = [
  { title: "Compre o pacote", text: "Pix, cartão ou boleto." },
  { title: "Receba o cupom", text: "Ele aparece na página do pedido." },
  { title: "Use quando quiser", text: "Informe o cupom ao pagar. Vale para vários pedidos." },
];

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
            <PackageCard key={pkg.id} pkg={pkg} regularUnitCents={regular} featured={pkg.photo_count === 300} />
          ))}
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="como-usar">
        <h2 id="como-usar" className="display-md text-2xl sm:text-3xl">
          Como usar o pacote
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {HOW.map((step, i) => (
            <li key={step.title}>
              <span className="display block text-4xl tabular-nums" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-2 text-lg font-bold">
                <span className="sr-only">Passo {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-1 max-w-[40ch] text-ink-2">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-ink-2">
          Frete à parte, em cada pedido.{" "}
          <Link href="/prazos-e-frete" className="link">
            Prazos e frete
          </Link>
        </p>
      </section>
    </>
  );
}
