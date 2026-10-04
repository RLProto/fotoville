"use client";

import { ListIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileMenu({
  items,
  loggedIn,
}: {
  items: { href: string; label: string }[];
  loggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [...items, { href: loggedIn ? "/conta" : "/entrar", label: loggedIn ? "Minha conta" : "Entrar" }];

  return (
    <div className="md:hidden">
      <button
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
        <nav
          id="menu-mobile"
          aria-label="Menu"
          className="absolute inset-x-0 top-[67px] border-b border-rule bg-surface px-4 pt-2 pb-5 shadow-lift [overscroll-behavior:contain]"
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
      )}
    </div>
  );
}
