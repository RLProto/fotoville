import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prazos e frete",
  description: `Produção em até ${site.productionDays} dias úteis, entrega pelos Correios em todo o Brasil ou retirada grátis em Joinville.`,
};

export default function PrazosPage() {
  const rows = [
    { label: "Produção", value: `Até ${site.productionDays} dias úteis`, note: "Depois do pagamento aprovado." },
    { label: "Entrega", value: "Correios, PAC ou SEDEX", note: "Prazo e valor aparecem antes de pagar." },
    {
      label: "Retirada",
      value: "Grátis na loja",
      note: `${site.address.street}, ${site.address.district}, ${site.address.city}/${site.address.state}.`,
    },
    { label: "Rastreio", value: "Na página do pedido", note: "Para entregas pelos Correios." },
  ];

  return (
    <>
      <PageHeader title="Prazos e frete" />
      <div className="container-page py-12">
        {/* Linhas de tabela, como no verso do envelope: rótulo à esquerda, o fato à direita */}
        <dl className="max-w-3xl border-t border-ink">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 border-b border-rule py-6 sm:grid-cols-[10rem_1fr] sm:gap-8">
              <dt className="pt-1 font-semibold text-ink-2">{row.label}</dt>
              <dd>
                <span className="display-md block text-2xl">{row.value}</span>
                <span className="mt-1 block text-ink-2">{row.note}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-lg">
          Algum problema com a entrega?{" "}
          <a
            href={whatsappLink("Olá, preciso de ajuda com a entrega do meu pedido.")}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            Falar no WhatsApp
          </a>
        </p>
      </div>
    </>
  );
}
