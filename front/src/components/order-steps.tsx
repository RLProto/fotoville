const STEPS = ["Tamanho", "Fotos", "Carrinho", "Entrega e pagamento"];

/** Indicador de etapas do pedido, do tamanho ao pagamento. */
export function OrderSteps({ current, className = "" }: { current: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <ol className={`flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-ink-2 ${className}`} aria-label="Etapas do pedido">
      {STEPS.map((step, i) => (
        <li key={step} aria-current={i + 1 === current ? "step" : undefined} className={i + 1 === current ? "text-ink" : undefined}>
          {i + 1}. {step}
        </li>
      ))}
    </ol>
  );
}
