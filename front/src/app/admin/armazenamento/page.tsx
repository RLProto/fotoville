import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

type Stats = {
  quota_bytes: number;
  total_bytes: number;
  total_files: number;
  groups: { grupo: "carrinho" | "aguardando" | "producao" | "concluido"; fotos: number; bytes: number }[];
  months: { mes: string; fotos: number; bytes: number }[];
  orders_deleted: number;
  orders_deletable: number;
};

const GROUPS: { id: Stats["groups"][number]["grupo"]; label: string; note: string }[] = [
  { id: "carrinho", label: "Em carrinhos", note: "fotos enviadas, pedido ainda não fechado" },
  { id: "aguardando", label: "Aguardando pagamento", note: "pedido fechado, sem pagamento" },
  { id: "producao", label: "Para produzir", note: "pagos, em produção ou prontos para retirada" },
  { id: "concluido", label: "Concluídos", note: "enviados, entregues ou cancelados: podem ser apagados" },
];

const MONTH = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtSize(bytes: number) {
  if (bytes < 1e6) return `${Math.round(bytes / 1e3)} kB`;
  if (bytes < 1e9) return `${Math.round(bytes / 1e6)} MB`;
  return `${(bytes / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
}
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Últimos seis meses, com zero onde não houve envio. */
function lastMonths(months: Stats["months"]) {
  const out: { key: string; label: string; fotos: number; bytes: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.mes === key);
    out.push({ key, label: MONTH[d.getMonth()], fotos: m?.fotos ?? 0, bytes: m?.bytes ?? 0 });
  }
  return out;
}

export default async function ArmazenamentoPage() {
  if (!(await getProfile())?.is_admin) notFound();

  const { data, error } = await createAdminClient().rpc("admin_storage_stats");
  const stats = (data ?? null) as Stats | null;

  if (error || !stats) {
    return (
      <>
        <h1 className="display-md text-3xl">Armazenamento</h1>
        <p className="alert alert-danger mt-6">
          Não foi possível ler o uso do bucket{error ? `: ${error.message}` : "."} Rode a migração
          2026-10-14_imagens_apagadas_e_armazenamento.sql.
        </p>
      </>
    );
  }

  const pct = stats.quota_bytes ? (stats.total_bytes / stats.quota_bytes) * 100 : 0;
  const tone = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";
  const byGroup = GROUPS.map((g) => ({ ...g, ...(stats.groups.find((x) => x.grupo === g.id) ?? { fotos: 0, bytes: 0 }) }));
  const maxGroup = Math.max(1, ...byGroup.map((g) => g.bytes));
  const deletable = byGroup.find((g) => g.id === "concluido")!;
  const months = lastMonths(stats.months);
  const maxMonth = Math.max(1, ...months.map((m) => m.fotos));

  return (
    <>
      <h1 className="display-md text-3xl">Armazenamento</h1>
      <p className="mt-1 text-ink-2">Bucket de fotos do Supabase. Os números são de agora.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="card p-5" aria-label="Espaço em uso">
          <p className="text-sm font-semibold text-ink-2">Em uso</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{fmtSize(stats.total_bytes)}</p>
          <p className="text-sm text-ink-2">
            de {fmtSize(stats.quota_bytes)} ({fmtPct(pct)})
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-badge bg-paper" role="img" aria-label={`${fmtPct(pct)} da cota em uso`}>
            <div className={`h-full rounded-badge ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </section>
        <section className="card p-5" aria-label="Arquivos no bucket">
          <p className="text-sm font-semibold text-ink-2">Arquivos</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{fmtInt(stats.total_files)}</p>
          <p className="text-sm text-ink-2">fotos e miniaturas</p>
        </section>
        <section className="card p-5" aria-label="Espaço que pode ser liberado">
          <p className="text-sm font-semibold text-ink-2">Pode liberar</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{fmtSize(deletable.bytes)}</p>
          <p className="text-sm text-ink-2">
            {stats.orders_deletable === 1 ? "1 pedido concluído" : `${fmtInt(stats.orders_deletable)} pedidos concluídos`} com
            imagens
          </p>
        </section>
        <section className="card p-5" aria-label="Pedidos já limpos">
          <p className="text-sm font-semibold text-ink-2">Já limpos</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{fmtInt(stats.orders_deleted)}</p>
          <p className="text-sm text-ink-2">pedidos sem imagens no bucket</p>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="onde">
          <h2 id="onde" className="text-lg font-bold">
            Onde estão as fotos
          </h2>
          <ul className="mt-4 space-y-3">
            {byGroup.map((g) => (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{g.label}</span>
                  <span className="tabular-nums text-ink-2">
                    {fmtSize(g.bytes)} · {fmtInt(g.fotos)} {g.fotos === 1 ? "foto" : "fotos"}
                  </span>
                </div>
                <div className="mt-1 h-3 rounded-[2px] bg-paper">
                  <div
                    className={`h-full rounded-[2px] ${g.id === "concluido" ? "bg-warning" : "bg-action"}`}
                    style={{ width: `${(g.bytes / maxGroup) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-ink-2">{g.note}</p>
              </li>
            ))}
          </ul>
          {deletable.bytes > 0 && (
            <p className="mt-4 text-sm">
              Para liberar espaço, abra um pedido concluído em{" "}
              <Link href="/admin?filtro=shipped" className="link">
                Pedidos
              </Link>{" "}
              e use &ldquo;Apagar imagens do bucket&rdquo;.
            </p>
          )}
        </section>

        <section className="card p-5" aria-labelledby="meses">
          <h2 id="meses" className="text-lg font-bold">
            Fotos enviadas por mês
          </h2>
          <p className="text-sm text-ink-2">Últimos seis meses, contando as que já foram apagadas.</p>
          <svg viewBox="0 0 360 180" className="mt-4 w-full" role="img" aria-label="Fotos enviadas por mês">
            {months.map((m, i) => {
              const h = (m.fotos / maxMonth) * 130;
              const x = 20 + i * 56;
              return (
                <g key={m.key}>
                  <title>{`${m.label}: ${fmtInt(m.fotos)} fotos, ${fmtSize(m.bytes)}`}</title>
                  <rect x={x} y={150 - h} width={40} height={h} rx={2} className="fill-action" />
                  {m.fotos > 0 && (
                    <text x={x + 20} y={144 - h} textAnchor="middle" className="fill-ink text-[11px] font-semibold tabular-nums">
                      {fmtInt(m.fotos)}
                    </text>
                  )}
                  <text x={x + 20} y={170} textAnchor="middle" className="fill-ink-2 text-[12px]">
                    {m.label}
                  </text>
                </g>
              );
            })}
            <line x1={16} y1={150.5} x2={344} y2={150.5} className="stroke-rule" />
          </svg>
        </section>
      </div>
    </>
  );
}
