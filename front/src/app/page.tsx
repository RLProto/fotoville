import Image from "next/image";
import Link from "next/link";
import { SizeBoard } from "@/components/size-board";
import { TierTable, tieredNames } from "@/components/tier-table";
import { getProducts } from "@/lib/catalog";
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
  { q: "Quanto tempo a foto dura?", a: "Revelação química em papel Fujifilm: durabilidade superior a 150 anos." },
];

function pick(products: Product[], ids: string[]) {
  return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
}

export default async function HomePage() {
  const products = await getProducts();
  const tiered = products.filter((p) => p.price_tiers.length > 0);
  // Maior desconto da tabela progressiva, para a chamada da seção
  const bestOff = Math.max(
    0,
    ...tiered.flatMap((p) => p.price_tiers.map((t) => Math.round((1 - t.price_cents / p.price_cents) * 100))),
  );
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
            <h1 className="display max-w-[14ch] text-[2.4rem] sm:text-5xl lg:text-6xl">Revele suas fotos sem sair de casa</h1>
            <p className="mt-5 text-lg text-ink-2">Entrega em todo o Brasil ou retirada em {site.address.city}.</p>
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

      {/* Desconto progressivo: o argumento de preço da loja, no campo mostarda */}
      {tiered.length > 0 && (
        <section className="bg-blade-mustard text-ink" aria-labelledby="progressivo">
          <div className="container-page grid items-start gap-10 py-16 lg:grid-cols-[1fr_1.4fr] lg:gap-14 lg:py-20">
            <div>
              <h2 id="progressivo" className="display text-3xl">
                Quanto mais fotos, menor o preço
              </h2>
              <p className="mt-4 text-lg">
                Desconto progressivo{bestOff > 0 ? ` de até ${bestOff}%` : ""} nos tamanhos {tieredNames(products)}.
              </p>
              <p className="mt-6">
                <Link href="/enviar" className="btn btn-outline">
                  Enviar fotos
                </Link>
              </p>
            </div>
            <TierTable products={products} onColor />
          </div>
        </section>
      )}

      {/* A loja: tempo de casa e onde fica. Fatos, sem lista de vantagens */}
      <section className="container-page grid items-start gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24" aria-labelledby="loja">
        <div>
          <h2 id="loja" className="display max-w-[18ch] text-3xl">
            Fotoville, desde {site.since} eternizando momentos
          </h2>
          <p className="mt-6 max-w-[40ch] text-lg">
            Revelação química em papel Fujifilm, com durabilidade superior a 150 anos.
          </p>
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
