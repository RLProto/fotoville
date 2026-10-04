import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Quem somos",
  description: `A Fotoville revela fotos em ${site.address.city} desde ${site.since}. Entrega em todo o Brasil ou retirada na loja.`,
};

export default function QuemSomosPage() {
  return (
    <>
      <PageHeader title="Quem somos" />
      <div className="container-page grid items-start gap-12 py-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div className="max-w-[54ch]">
          <p className="display-md text-2xl sm:text-3xl">
            A Fotoville revela fotos em {site.address.city} desde {site.since}.
          </p>
          <div className="mt-6 space-y-4 text-lg text-ink-2">
            <p>Revelamos de 10x13 a 30x60, além de Mini Polaroid, Polaroid e foto-placa.</p>
            <p>Você envia as fotos pelo site e recebe pelos Correios em todo o Brasil, ou retira na loja sem custo.</p>
          </div>
          <p className="mt-10">
            <Link href="/enviar" className="btn btn-accent btn-lg">
              Enviar fotos
            </Link>
          </p>
        </div>

        <section aria-labelledby="loja" className="border-t border-ink pt-5">
          <h2 id="loja" className="text-lg font-bold">
            Loja e retirada
          </h2>
          <address className="mt-2 text-lg leading-relaxed not-italic">
            {site.address.street}
            <br />
            {site.address.district}, {site.address.city}/{site.address.state}
            <br />
            CEP {site.address.cep}
          </address>
          <p className="mt-4">
            <Link href="/contato" className="link">
              Contato e mapa
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
