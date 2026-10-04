import Link from "next/link";

const STEPS: { label: string; href?: string }[] = [
  { label: "Tamanho", href: "/enviar" },
  { label: "Fotos" },
  { label: "Carrinho", href: "/carrinho" },
  { label: "Entrega e pagamento" },
];

/** Indicador de etapas do pedido, do tamanho ao pagamento. Etapas já feitas viram links para voltar. */
export function OrderSteps({ current, className = "" }: { current: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <nav aria-label="Etapas do pedido" className={className}>
      {/* No celular, uma linha curta no lugar das quatro etapas */}
      <p className="text-sm font-bold text-ink-2 sm:hidden">
        Etapa {current} de {STEPS.length}: <span className="text-ink">{STEPS[current - 1].label}</span>
      </p>
      <ol className="hidden flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-ink-2 sm:flex">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const done = n < current;
          return (
            <li key={step.label} aria-current={n === current ? "step" : undefined}>
              {done && step.href ? (
                <Link href={step.href} className="hover:text-ink hover:underline">
                  {n}. {step.label}
                </Link>
              ) : (
                <span className={n === current ? "text-ink underline decoration-2 underline-offset-[6px]" : undefined}>
                  {n}. {step.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
