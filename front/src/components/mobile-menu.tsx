"use client";

import { ListIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function MobileMenu({
  items,
  loggedIn,
  isAdmin = false,
}: {
  items: { href: string; label: string }[];
  loggedIn: boolean;
  /** Mostra o link do painel da loja. */
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Menu aberto: a página não rola por baixo, o foco vai para o menu e fica nele até fechar
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    navRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [toggleRef.current, ...(navRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])].filter(
        (el): el is HTMLElement => Boolean(el),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [
    ...items,
    ...(isAdmin ? [{ href: "/admin", label: "Painel da loja" }] : []),
    { href: loggedIn ? "/conta" : "/entrar", label: loggedIn ? "Minha conta" : "Entrar" },
  ];

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-ink/[0.05]"
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <XIcon size={24} aria-hidden /> : <ListIcon size={24} aria-hidden />}
      </button>

      {open && (
        <>
          {/* Toque fora do menu fecha (a página não rola enquanto ele está aberto) */}
          <div className="absolute inset-x-0 top-[67px] h-dvh bg-ink/20" aria-hidden onClick={() => setOpen(false)} />
          <nav
            ref={navRef}
            id="menu-mobile"
            aria-label="Menu"
            className="absolute inset-x-0 top-[67px] max-h-[calc(100dvh-67px)] overflow-y-auto border-b border-rule bg-surface px-4 pt-2 pb-5 shadow-lift [overscroll-behavior:contain]"
          >
            <ul className="flex flex-col">
              {links.map((item) => {
                const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center rounded-control px-3 text-lg ${
                        current ? "bg-action-soft font-semibold text-ink" : "text-ink-2 hover:bg-ink/[0.04]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/enviar" onClick={() => setOpen(false)} className="btn btn-accent mt-3 w-full">
              Enviar fotos
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}
