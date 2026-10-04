import { EnvelopeSimpleIcon, MapPinIcon, WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description: "WhatsApp, e-mail e endereço da Fotoville em Joinville/SC.",
};

export default function ContatoPage() {
  const mapsQuery = encodeURIComponent(
    `${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.state}, ${site.address.cep}`,
  );
  const channels = [
    {
      Icon: WhatsappLogoIcon,
      title: "WhatsApp",
      value: site.whatsappDisplay,
      href: whatsappLink(),
      action: "Abrir conversa",
      external: true,
    },
    {
      Icon: EnvelopeSimpleIcon,
      title: "E-mail",
      value: site.email,
      href: `mailto:${site.email}`,
      action: "Escrever e-mail",
      external: false,
    },
    {
      Icon: MapPinIcon,
      title: "Loja",
      value: `${site.address.street}, ${site.address.district}, ${site.address.city}/${site.address.state}`,
      href: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
      action: "Ver no mapa",
      external: true,
    },
  ];

  return (
    <>
      <PageHeader title="Fale com a gente" />
      <ul className="container-page grid gap-10 py-12 md:grid-cols-3">
        {channels.map(({ Icon, title, value, href, action, external }) => (
          <li key={title} className="flex flex-col border-t-2 border-ink pt-4">
            <Icon size={26} className="text-action" aria-hidden />
            <h2 className="mt-3 text-lg font-bold">{title}</h2>
            <p className="mt-1 mb-5 break-words text-ink-2">{value}</p>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="btn btn-outline mt-auto self-start"
            >
              {action}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
