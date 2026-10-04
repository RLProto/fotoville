"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatBRL } from "@/lib/format";
import type { Package } from "@/lib/types";

/** Pacote pré-pago desenhado como canhoto picotado. */
export function PackageCard({
  pkg,
  regularUnitCents,
}: {
  pkg: Package;
  /** Preço avulso da foto, para mostrar a economia real. */
  regularUnitCents: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = Math.round(pkg.price_cents / pkg.photo_count);
  const saving = regularUnitCents * pkg.photo_count - pkg.price_cents;
  const percent = Math.round((1 - unit / regularUnitCents) * 100);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/pacote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (res.status === 401) {
        router.push(`/entrar?proximo=${encodeURIComponent("/promocoes")}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível abrir o pagamento. Tente de novo.");
      window.location.assign(data.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o pagamento. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <article className="flex flex-col rounded-panel bg-surface px-6 pt-5 pb-6 text-ink">
      <h3>
        <span className="display block text-3xl tabular-nums">{pkg.photo_count}</span>
        <span className="text-sm text-ink-2">fotos 10x15</span>
      </h3>

      <p className="mt-4 text-2xl font-extrabold tabular-nums" style={{ fontStretch: "112%" }}>
        {formatBRL(pkg.price_cents)}
      </p>
      <p className="text-sm text-ink-2 tabular-nums">
        {formatBRL(unit)} por foto
        {saving > 0 && <>, {percent}% de desconto</>}
      </p>

      <div className="perforation mt-5 pt-5">
        <button
          type="button"
          onClick={buy}
          disabled={loading}
          className="btn btn-outline w-full"
        >
          {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          {loading ? "Abrindo pagamento…" : "Comprar pacote"}
        </button>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
