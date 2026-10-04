"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Pedidos", match: (p: string) => p === "/admin" || p.startsWith("/admin/pedidos") },
  { href: "/admin/precos", label: "Preços", match: (p: string) => p.startsWith("/admin/precos") },
  { href: "/admin/perfis", label: "Perfis", match: (p: string) => p.startsWith("/admin/perfis") },
  { href: "/admin/clientes", label: "Clientes", match: (p: string) => p.startsWith("/admin/clientes") },
  { href: "/admin/erros", label: "Erros", match: (p: string) => p.startsWith("/admin/erros") },
];

/** Abas do painel da loja, com a contagem de erros em aberto no site. */
export function AdminNav({ openErrors }: { openErrors: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel da loja" className="-mx-4 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((item) => {
          const current = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 font-semibold transition-colors duration-150 ${
                  current ? "border-action text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {item.label}
                {item.href === "/admin/erros" && openErrors > 0 && (
                  <span className="badge bg-danger-soft text-danger tabular-nums">{openErrors}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
