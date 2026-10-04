"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Links do menu com a página atual marcada (aria-current e sublinhado). */
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 items-center border-b-2 px-3 font-medium transition-colors duration-150 ${
              current
                ? "border-action text-ink"
                : "border-transparent text-ink-2 hover:border-rule hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
