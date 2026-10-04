import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prazos e frete",
  description: "Produção em até 3 dias úteis, entrega pelos Correios em todo o Brasil ou retirada grátis em Joinville.",
};

export default function PrazosPage() {
  const items = [
    { title: "Produção", big: `Até ${site.productionDays} dias úteis`, text: "Depois do pagamento aprovado." },
    { title: "Entrega", big: "PAC ou SEDEX", text: "Prazo e valor aparecem antes de pagar." },
    { title: "Retirada", big: "Grátis na loja", text: `${site.address.street}, ${site.address.district}.` },
  ];

  return (
    <>
      <PageHeader title="Prazos e frete" />
      <div className="container-page py-12">
        <dl className="grid gap-10 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="border-t-2 border-ink pt-4">
              <dt className="text-ink-2">{item.title}</dt>
              <dd className="display-md mt-1 text-2xl">{item.big}</dd>
              <dd className="mt-2 text-ink-2">{item.text}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-14 space-y-3 text-lg">
          <li>O código de rastreio aparece na página do pedido.</li>
          <li>
            Algum problema com a entrega?{" "}
            <a
              href={whatsappLink("Olá, preciso de ajuda com a entrega do meu pedido.")}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Fale com a gente no WhatsApp
            </a>
          </li>
        </ul>
      </div>
    </>
  );
}
