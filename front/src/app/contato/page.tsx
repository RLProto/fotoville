import { MapPinIcon, WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description: `WhatsApp, e-mail e endereço da Fotoville em ${site.address.city}/${site.address.state}.`,
};

export default function ContatoPage() {
  const mapsQuery = encodeURIComponent(
    `${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.state}, ${site.address.cep}`,
  );

  return (
    <>
      <PageHeader title="Fale com a gente" />
      {/* O WhatsApp é o canal principal; e-mail e loja vêm em seguida, com menos peso */}
      <div className="container-page grid gap-12 py-12 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
        <section aria-labelledby="whatsapp">
          <h2 id="whatsapp" className="text-lg font-bold">
            WhatsApp
          </h2>
          <p className="display-md mt-1 text-3xl tabular-nums sm:text-4xl">{site.whatsappDisplay}</p>
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-lg mt-6">
            <WhatsappLogoIcon size={22} aria-hidden />
            Abrir conversa
          </a>
          <p className="mt-8 text-ink-2">
            Prefere e-mail?{" "}
            <a href={`mailto:${site.email}`} className="link break-all">
              {site.email}
            </a>
          </p>
        </section>

        <section aria-labelledby="loja" className="border-t border-rule pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
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
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline mt-6"
          >
            <MapPinIcon size={18} aria-hidden />
            Ver no mapa
          </a>
        </section>
      </div>
    </>
  );
}
