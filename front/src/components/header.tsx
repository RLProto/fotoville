import { HandbagIcon, UserIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { hasSupabase } from "@/lib/site";
import { createClient, getUser } from "@/lib/supabase/server";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export const NAV = [
  { href: "/precos", label: "Preços" },
  { href: "/promocoes", label: "Pacotes" },
  { href: "/prazos-e-frete", label: "Prazos e frete" },
  { href: "/contato", label: "Contato" },
];

async function cartCount(userId: string) {
  const supabase = await createClient();
  // Soma as cópias: é o que o cliente paga e o que o carrinho mostra
  const { data } = await supabase.from("photos").select("quantity").eq("user_id", userId).is("order_id", null);
  return (data ?? []).reduce((sum, p) => sum + (p.quantity ?? 1), 0);
}

export async function Header() {
  const user = hasSupabase ? await getUser() : null;
  const count = user ? await cartCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fotoville, página inicial">
          <Image src="/logo-icon.png" alt="" width={36} height={36} priority />
          <span translate="no" className="text-lg font-extrabold tracking-[0.18em] text-ink" style={{ fontStretch: "118%" }}>
            FOTOVILLE
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center md:flex">
          <NavLinks items={NAV} />
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={user ? "/conta" : "/entrar"}
            className="hidden min-h-11 items-center gap-2 rounded-control px-3 font-medium text-ink-2 transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink sm:inline-flex"
          >
            <UserIcon size={20} aria-hidden />
            {/* Entre 768 e 1023 px o menu e o botão disputam espaço: fica só o ícone */}
            <span className="md:max-lg:sr-only">{user ? "Minha conta" : "Entrar"}</span>
          </Link>
          <Link
            href="/carrinho"
            className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink"
            aria-label={count ? `Carrinho, ${count} ${count === 1 ? "foto" : "fotos"}` : "Carrinho"}
          >
            <HandbagIcon size={23} aria-hidden />
            {count > 0 && (
              <span className="absolute top-1 right-0.5 min-w-5 rounded-[3px] bg-ink px-1 text-center text-xs leading-5 font-semibold text-surface tabular-nums">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          <Link href="/enviar" className="btn btn-accent btn-sm ml-1 hidden md:inline-flex">
            Enviar fotos
          </Link>
          <MobileMenu items={NAV} loggedIn={Boolean(user)} />
        </div>
      </div>
      <div className="blade-strip h-[3px]" aria-hidden />
    </header>
  );
}
