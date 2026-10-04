import Image from "next/image";
import Link from "next/link";
import { site, whatsappLink } from "@/lib/site";

const LINKS = [
  { href: "/precos", label: "Preços" },
  { href: "/promocoes", label: "Promoções" },
  { href: "/prazos-e-frete", label: "Prazos e frete" },
  { href: "/quem-somos", label: "Quem somos" },
  { href: "/contato", label: "Contato" },
  { href: "/conta", label: "Meus pedidos" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_1.2fr]">
        <div className="flex items-start gap-4">
          <Image src="/logo-icon.png" alt="" width={44} height={44} />
          <div>
            <p translate="no" className="font-extrabold tracking-[0.18em]" style={{ fontStretch: "118%" }}>
              FOTOVILLE
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="link">
                WhatsApp {site.whatsappDisplay}
              </a>
              <br />
              <a href={`mailto:${site.email}`} className="link break-all">
                {site.email}
              </a>
            </p>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <nav aria-label="Rodapé">
            <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-1">
              {LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-flex min-h-9 items-center text-ink-2 hover:text-ink hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <address className="text-sm leading-relaxed text-ink-2 not-italic">
            <span className="font-semibold text-ink">Loja e retirada</span>
            <br />
            {site.address.street}
            <br />
            {site.address.district}, {site.address.city}/{site.address.state}
            <br />
            CEP {site.address.cep}
          </address>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="container-page flex flex-col gap-x-6 gap-y-1 pt-4 pb-24 text-sm text-ink-2 sm:flex-row sm:pr-24 sm:pb-5">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <Link href="/termos-de-uso" className="hover:text-ink hover:underline">
            Termos de uso
          </Link>
          <Link href="/politica-de-privacidade" className="hover:text-ink hover:underline">
            Política de privacidade
          </Link>
          <p className="sm:ml-auto">Pagamento pelo Mercado Pago</p>
        </div>
      </div>
    </footer>
  );
}
