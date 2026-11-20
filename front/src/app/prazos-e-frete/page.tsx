import { MapPinIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prazos e frete",
  description: `Pedido pronto em até ${site.productionDays} dias úteis. Correios para todo o Brasil, entrega em Joinville ou retirada grátis na loja.`,
};

export default function PrazosPage() {
  const mapsQuery = encodeURIComponent(
    `${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.state}, ${site.address.cep}`,
  );

  const entregas = [
    "Correios para todo o Brasil, PAC ou SEDEX.",
    `Entrega nos principais bairros de ${site.address.city}.`,
    "Retirada grátis na loja.",
  ];

  return (
    <>
      <PageHeader title="Prazos e frete" />
      <div className="container-page grid items-start gap-12 py-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div className="max-w-[54ch]">
          <p className="display-md text-2xl sm:text-3xl">
            Seu pedido fica pronto em até {site.productionDays} dias úteis depois do pagamento.
          </p>

          <h2 className="mt-12 text-lg font-bold">Entrega</h2>
          <ul className="mt-3 border-t border-ink text-lg">
            {entregas.map((item) => (
              <li key={item} className="border-b border-rule py-4">
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-ink-2">
            Dúvida sobre a entrega?{" "}
            <a
              href={whatsappLink("Olá, tenho uma dúvida sobre a entrega do meu pedido.")}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Falar no WhatsApp
            </a>
          </p>
        </div>

        <section aria-labelledby="retirada" className="border-t border-ink pt-5">
          <h2 id="retirada" className="text-lg font-bold">
            Retirada
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
