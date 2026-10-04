import Image from "next/image";
import Link from "next/link";
import { PackageCard } from "@/components/package-card";
import { SizeBoard } from "@/components/size-board";
import { getPackages, getProducts } from "@/lib/catalog";
import { site, whatsappLink } from "@/lib/site";
import type { Product } from "@/lib/types";

const BOARD_SIZES = ["polaroid", "10x15", "13x18", "15x21", "20x30", "30x40"];

const STEPS = [
  { title: "Envie as fotos", text: "Do celular ou do computador." },
  { title: "Ajuste o corte", text: "Veja como cada foto vai sair." },
  { title: "Receba em casa", text: "Ou retire na loja, sem frete." },
];

const FACTS = ["Ajuste foto a foto antes de pagar", "Atendimento pelo WhatsApp", `Retirada grátis em ${site.address.city}`];

const FAQ = [
  { q: "Quais arquivos posso enviar?", a: "JPG, PNG ou WebP, até 40 MB por foto." },
  { q: "E se a foto não tiver o formato do papel?", a: "Você ajusta o corte ou imprime a foto inteira, com borda branca." },
  {
    q: "Quanto tempo demora?",
    a: `Produção em até ${site.productionDays} dias úteis. O prazo de entrega aparece antes de pagar.`,
  },
  { q: "Posso misturar tamanhos?", a: "Sim, tudo no mesmo pedido." },
];

function pick(products: Product[], ids: string[]) {
  return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
}

export default async function HomePage() {
  const [products, packages] = await Promise.all([getProducts(), getPackages()]);
  const tenByFifteen = products.find((p) => p.id === "10x15");

  return (
    <>
      {/* Topo: a foto de um lado, o convite para enviar do outro. O tamanho se escolhe no passo seguinte. */}
      <section className="relative">
        <div className="relative h-52 sm:h-96 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[48%]">
          <Image
            src="/hero-fotos.jpg"
            alt="Mão segurando três fotos de família reveladas em papel"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-[22%_50%]"
          />
        </div>

        <div className="container-page lg:grid lg:min-h-[560px] lg:grid-cols-[48%_1fr] lg:items-center">
          <div className="hidden lg:block" />
          <div className="py-10 lg:py-14 lg:pl-14">
            <h1 className="display text-[2.15rem] sm:text-5xl">Revele suas fotos</h1>
            <p className="mt-4 max-w-[46ch] text-lg text-ink-2">
              Envie pelo site e receba em todo o Brasil.
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

      {/* Os três passos: uma sequência real, por isso numerada */}
      <section className="bg-blade-teal text-surface" aria-labelledby="como-funciona">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_2.2fr] lg:py-16">
          <h2 id="como-funciona" className="display text-3xl sm:text-4xl">
            Como funciona
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="display block text-5xl tabular-nums" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-[#d6e1e1]">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* A régua de tamanhos */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="tamanhos">
        <h2 id="tamanhos" className="display text-3xl sm:text-4xl">
          Veja o tamanho real
        </h2>
        <p className="mt-3 text-lg text-ink-2">Na mesma escala, ao lado de um celular.</p>
        <div className="mt-12">
          <SizeBoard products={pick(products, BOARD_SIZES)} />
        </div>
        <p className="mt-6">
          <Link href="/precos" className="link">
            Ver os {products.length} tamanhos e preços
          </Link>
        </p>
      </section>

      {/* Pacotes pré-pagos */}
      {packages.length > 0 && tenByFifteen && (
        <section
          className="bg-blade-mustard text-ink"
          aria-labelledby="pacotes"
          style={{ ["--perforation-bg" as string]: "var(--color-blade-mustard)" }}
        >
          <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_2.2fr] lg:py-20">
            <div>
              <h2 id="pacotes" className="display text-3xl sm:text-4xl">
                Compre agora, revele depois
              </h2>
              <p className="mt-4 text-lg">Pacotes 10x15 com desconto. Use quando quiser.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  regularUnitCents={tenByFifteen.price_cents}
                  featured={pkg.photo_count === 300}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Prova: o papel e o tempo de casa */}
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24" aria-labelledby="papel">
        <div>
          <h2 id="papel" className="display max-w-[16ch] text-3xl sm:text-4xl">
            Revelando em {site.address.city} desde {site.since}
          </h2>
          <Image src="/papeis-kodak-fuji.png" alt="Papéis Kodak e Fujifilm" width={298} height={63} className="mt-8" />
        </div>
        <ul className="space-y-4 text-xl font-semibold">
          {FACTS.map((fact) => (
            <li key={fact} className="border-t border-rule pt-4">
              {fact}
            </li>
          ))}
        </ul>
      </section>

      {/* Perguntas: só as que mudam a decisão */}
      <section className="border-t border-rule" aria-labelledby="duvidas">
        <div className="container-page py-16 lg:py-20">
          <h2 id="duvidas" className="display text-3xl sm:text-4xl">
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
              Fale no WhatsApp
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
