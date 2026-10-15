import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

type Day = { day: string; views: number; visitors: number; orders: number; paid: number; revenue_cents: number; signups: number };
type Stats = {
  days: Day[];
  totals: { views: number; visitors: number; orders: number; paid: number; revenue_cents: number; signups: number };
  sizes: { id: string | null; name: string; copies: number }[];
  delivery: { service: string; orders: number }[];
  tracking_since: string | null;
};

const PERIODS = [7, 30, 90];
const DELIVERY_LABEL: Record<string, string> = {
  retirada: "Retirada na loja",
  pac: "Correios PAC",
  sedex: "Correios SEDEX",
  motoboy: "Motoboy",
  nenhuma: "Sem entrega (pacote)",
};
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Series = { label: string; values: number[]; color: string; line?: boolean };

/**
 * Colunas por dia, uma escala só. Com duas séries, a segunda vai como linha fina por cima
 * (mesma unidade), com legenda. Hover mostra o dia e os valores.
 */
function DayChart({ days, series, title }: { days: Day[]; series: Series[]; title: string }) {
  const W = 720;
  const H = 220;
  const left = 36;
  const bottom = 28;
  const top = 16;
  const plotW = W - left - 12;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const step = plotW / days.length;
  const barW = Math.max(2, Math.min(28, step * 0.62));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const x = (i: number) => left + i * step + step / 2;
  const labelEvery = days.length > 45 ? 15 : days.length > 10 ? 5 : 1;
  const gridValues = max >= 2 ? [max, max / 2] : [max];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={title}>
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={left} x2={W - 12} y1={y(v)} y2={y(v)} className="stroke-rule" strokeDasharray="2 4" />
            <text x={left - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-2 text-[11px] tabular-nums">
              {fmtInt(Math.round(v))}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const bar = series.find((s) => !s.line)!;
          const h = (bar.values[i] / max) * plotH;
          return (
            <g key={d.day}>
              <title>{`${shortDay(d.day)}: ${series.map((s) => `${s.label} ${fmtInt(s.values[i])}`).join(", ")}`}</title>
              <rect x={x(i) - barW / 2} y={y(bar.values[i])} width={barW} height={h} rx={2} fill={bar.color} />
              {/* alvo de hover maior que a coluna */}
              <rect x={x(i) - step / 2} y={top} width={step} height={plotH} fill="transparent" />
              {i % labelEvery === 0 && (
                <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-2 text-[11px]">
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
        {series
          .filter((s) => s.line)
          .map((s) => (
            <polyline
              key={s.label}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          ))}
        <line x1={left} x2={W - 12} y1={top + plotH + 0.5} y2={top + plotH + 0.5} className="stroke-rule" />
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={s.line ? "inline-block h-0.5 w-4" : "inline-block size-3 rounded-[2px]"}
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-2">Ver em tabela</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-semibold">Dia</th>
              {series.map((s) => (
                <th key={s.label} className="py-1 pr-3 font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day} className="border-t border-rule">
                <td className="py-1 pr-3">{shortDay(d.day)}</td>
                {series.map((s) => (
                  <td key={s.label} className="py-1 pr-3">
                    {fmtInt(s.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <section className="card p-5" aria-label={label}>
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {note && <p className="text-sm text-ink-2">{note}</p>}
    </section>
  );
}

export default async function EstatisticasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  if (!(await getProfile())?.is_admin) notFound();
  const wanted = Number((await searchParams).dias);
  const days = PERIODS.includes(wanted) ? wanted : 30;

  const { data, error } = await createAdminClient().rpc("admin_stats", { days });
  const stats = (data ?? null) as Stats | null;
  if (error || !stats) {
    return (
      <>
        <h1 className="display-md text-3xl">Estatísticas</h1>
        <p className="alert alert-danger mt-6">
          Não foi possível ler as estatísticas{error ? `: ${error.message}` : "."} Rode a migração 2026-10-15_estatisticas.sql.
        </p>
      </>
    );
  }

  const t = stats.totals;
  const ticket = t.paid ? t.revenue_cents / t.paid : 0;
  const conversion = t.visitors ? (t.paid / t.visitors) * 100 : 0;
  const paidRate = t.orders ? (t.paid / t.orders) * 100 : 0;
  const maxSize = Math.max(1, ...stats.sizes.map((s) => s.copies));
  const deliveryTotal = Math.max(1, stats.delivery.reduce((sum, d) => sum + d.orders, 0));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-md text-3xl">Estatísticas</h1>
          <p className="mt-1 text-ink-2">
            Por dia, em horário de Brasília.
            {stats.tracking_since && ` Visitas contadas desde ${shortDay(stats.tracking_since)}.`}
          </p>
        </div>
        <nav aria-label="Período" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/estatisticas?dias=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={`btn btn-sm ${p === days ? "btn-primary" : "btn-outline"}`}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Visitantes" value={fmtInt(t.visitors)} note={`${fmtInt(t.views)} páginas abertas`} />
        <Tile label="Pedidos pagos" value={fmtInt(t.paid)} note={`${fmtInt(t.orders)} criados, ${fmtPct(paidRate)} pagos`} />
        <Tile label="Receita" value={formatBRL(t.revenue_cents)} note="pedidos pagos no período" />
        <Tile label="Ticket médio" value={formatBRL(Math.round(ticket))} note="por pedido pago" />
        <Tile label="Conversão" value={fmtPct(conversion)} note="pedidos pagos por visitante" />
        <Tile label="Novos cadastros" value={fmtInt(t.signups)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="acessos">
          <h2 id="acessos" className="text-lg font-bold">
            Acessos por dia
          </h2>
          <DayChart
            title="Acessos por dia"
            days={stats.days}
            series={[
              { label: "Visitantes", values: stats.days.map((d) => d.visitors), color: "var(--color-action)" },
              { label: "Páginas abertas", values: stats.days.map((d) => d.views), color: "var(--color-blade-teal)", line: true },
            ]}
          />
        </section>

        <section className="card p-5" aria-labelledby="pedidos">
          <h2 id="pedidos" className="text-lg font-bold">
            Pedidos por dia
          </h2>
          <DayChart
            title="Pedidos por dia"
            days={stats.days}
            series={[
              { label: "Criados", values: stats.days.map((d) => d.orders), color: "var(--color-action)" },
              { label: "Pagos", values: stats.days.map((d) => d.paid), color: "var(--color-success)", line: true },
            ]}
          />
        </section>

        <section className="card p-5" aria-labelledby="cadastros">
          <h2 id="cadastros" className="text-lg font-bold">
            Novos cadastros por dia
          </h2>
          <DayChart
            title="Novos cadastros por dia"
            days={stats.days}
            series={[{ label: "Cadastros", values: stats.days.map((d) => d.signups), color: "var(--color-action)" }]}
          />
        </section>

        <section className="card p-5" aria-labelledby="receita">
          <h2 id="receita" className="text-lg font-bold">
            Receita por dia
          </h2>
          <DayChart
            title="Receita por dia, em reais"
            days={stats.days}
            series={[{ label: "Reais", values: stats.days.map((d) => Math.round(d.revenue_cents / 100)), color: "var(--color-success)" }]}
          />
        </section>

        <section className="card p-5" aria-labelledby="tamanhos">
          <h2 id="tamanhos" className="text-lg font-bold">
            Tamanhos mais vendidos
          </h2>
          <p className="text-sm text-ink-2">Cópias em pedidos pagos no período.</p>
          {stats.sizes.length === 0 ? (
            <p className="mt-4 text-ink-2">Nenhum pedido pago no período.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {stats.sizes.map((s) => (
                <li key={s.id ?? s.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold">{s.name}</span>
                    <span className="tabular-nums text-ink-2">{fmtInt(s.copies)}</span>
                  </div>
                  <div className="mt-1 h-3 rounded-[2px] bg-paper">
                    <div className="h-full rounded-[2px] bg-action" style={{ width: `${(s.copies / maxSize) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="entregas">
          <h2 id="entregas" className="text-lg font-bold">
            Como os clientes recebem
          </h2>
          <p className="text-sm text-ink-2">Pedidos pagos no período.</p>
          {stats.delivery.length === 0 ? (
            <p className="mt-4 text-ink-2">Nenhum pedido pago no período.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {stats.delivery.map((d) => (
                <li key={d.service}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold">{DELIVERY_LABEL[d.service] ?? d.service}</span>
                    <span className="tabular-nums text-ink-2">
                      {fmtInt(d.orders)} · {fmtPct((d.orders / deliveryTotal) * 100)}
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded-[2px] bg-paper">
                    <div className="h-full rounded-[2px] bg-action" style={{ width: `${(d.orders / deliveryTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
