import Image from "next/image";
import Link from "next/link";
import { PackageCard } from "@/components/package-card";
import { SizeBoard } from "@/components/size-board";
import { getPackages, getProducts } from "@/lib/catalog";
import { site, whatsappLink } from "@/lib/site";
import type { Product } from "@/lib/types";

const BOARD_SIZES = ["mini-polaroid", "polaroid", "10x15", "13x18", "15x21", "20x30", "30x40"];

const FAQ = [
  { q: "Quais arquivos posso enviar?", a: "JPG, PNG ou WebP, até 40 MB por foto." },
  { q: "E se a foto não couber no tamanho?", a: "Você ajusta o corte ou imprime a foto inteira, com borda branca." },
  {
    q: "Quanto tempo demora?",
    a: `Produção em até ${site.productionDays} dias úteis. O prazo de entrega e o frete aparecem antes de pagar.`,
  },
  { q: "Posso misturar tamanhos?", a: "Sim, tudo no mesmo pedido." },
];

function pick(products: Product[], ids: string[]) {
  return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
}

export default async function HomePage() {
  const [products, packages] = await Promise.all([getProducts(), getPackages()]);
  const found = products.find((p) => p.id === "10x15");
  // Pacote tem preço da loja: a economia é calculada contra a tabela da loja, mesmo para cliente com perfil
  const tenByFifteen = found && { ...found, price_cents: found.store?.price_cents ?? found.price_cents };
  const bestDiscount = tenByFifteen
    ? Math.max(0, ...packages.map((p) => Math.round((1 - p.price_cents / p.photo_count / tenByFifteen.price_cents) * 100)))
    : 0;
  const mapsQuery = encodeURIComponent(
    `${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.state}, ${site.address.cep}`,
  );

  return (
    <>
      {/* Topo: a foto de um lado, o convite para enviar do outro. O tamanho se escolhe no passo seguinte. */}
      <section className="relative">
        <div className="relative h-52 sm:h-96 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[48%]">
          <Image
            src="/hero-fotos.jpg"
            alt="Mão segurando três fotos de família reveladas"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-[22%_50%]"
          />
        </div>

        <div className="container-page lg:grid lg:min-h-[560px] lg:grid-cols-[48%_1fr] lg:items-center">
          <div className="hidden lg:block" />
          <div className="py-10 lg:py-14 lg:pl-14">
            <h1 className="display text-[2.4rem] sm:text-5xl lg:text-6xl">Revele suas fotos</h1>
            <p className="mt-5 max-w-[40ch] text-lg text-ink-2">
              Confira como cada foto vai sair antes de pagar. Entrega em todo o Brasil ou retirada em {site.address.city}.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/enviar" className="btn btn-accent btn-lg w-full sm:w-auto">
                Enviar fotos
              </Link>
              <Link href="/precos" className="link text-lg">
                Ver preços
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* A régua de tamanhos: o que só a Fotoville mostra, por isso ganha o campo de cor */}
      <section className="bg-blade-teal text-surface" aria-labelledby="tamanhos">
        <div className="container-page py-16 lg:py-20">
          <h2 id="tamanhos" className="display text-3xl">
            Compare os tamanhos
          </h2>
          <div className="mt-10">
            <SizeBoard products={pick(products, BOARD_SIZES)} onColor />
          </div>
          <p className="mt-6">
            <Link href="/precos" className="font-semibold text-surface underline underline-offset-2 hover:text-[#d6e1e1]">
              Ver os {products.length} tamanhos e preços
            </Link>
          </p>
        </div>
      </section>

      {/* Pacotes pré-pagos */}
      {packages.length > 0 && tenByFifteen && (
        <section
          className="bg-blade-mustard text-ink"
          aria-labelledby="pacotes"
          style={{ ["--perforation-bg" as string]: "var(--color-blade-mustard)" }}
        >
          {/* Título em cima e os quatro pacotes numa fileira só no desktop */}
          <div className="container-page py-16 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              <h2 id="pacotes" className="display text-3xl">
                Compre agora, revele depois
              </h2>
              <p className="text-lg">
                Pacotes de fotos 10x15{bestDiscount > 0 ? ` com até ${bestDiscount}% de desconto` : ""}. Frete à parte.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} regularUnitCents={tenByFifteen.price_cents} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* A loja: tempo de casa e onde fica. Fatos, sem lista de vantagens */}
      <section className="container-page grid items-start gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24" aria-labelledby="loja">
        <div>
          <h2 id="loja" className="display max-w-[16ch] text-3xl">
            Revelando em {site.address.city} desde {site.since}
          </h2>
        </div>
        <div className="border-t border-ink pt-5">
          <h3 className="text-lg font-bold">Retirada grátis na loja</h3>
          <address className="mt-2 text-lg leading-relaxed text-ink-2 not-italic">
            {site.address.street}
            <br />
            {site.address.district}, {site.address.city}/{site.address.state}
          </address>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Ver no mapa
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="link">
              WhatsApp {site.whatsappDisplay}
            </a>
          </p>
        </div>
      </section>

      {/* Perguntas: só as que mudam a decisão */}
      <section className="border-t border-rule" aria-labelledby="duvidas">
        <div className="container-page py-16 lg:py-20">
          <h2 id="duvidas" className="display text-3xl">
            Perguntas frequentes
          </h2>
          <dl className="mt-10 grid gap-x-14 gap-y-8 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-lg font-bold">{item.q}</dt>
                <dd className="mt-1 text-ink-2">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-12 text-lg">
            Outra dúvida?{" "}
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="link">
              Falar no WhatsApp
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
