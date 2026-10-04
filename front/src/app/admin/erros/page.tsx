import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResolveErrorButton } from "@/components/admin/resolve-error-button";
import { formatDateTime, plural } from "@/lib/format";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Erros do site" };

type ErrorLog = {
  id: number;
  created_at: string;
  level: "error" | "warning";
  source: "client" | "server";
  scope: string;
  message: string;
  detail: Record<string, unknown> | null;
  url: string | null;
  user_id: string | null;
  user_agent: string | null;
  env: string;
  resolved_at: string | null;
};

/** Por padrão só o site publicado; os erros de teste na máquina de desenvolvimento ficam num filtro à parte. */
const FILTERS = [
  { value: "abertos", label: "Abertos" },
  { value: "todos", label: "Todos" },
  { value: "teste", label: "Teste local" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/** Aparelho e navegador em poucas palavras, a partir do user agent. */
function device(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "outro";
  const browser =
    ua.match(/SamsungBrowser\/(\d+)/)?.[0].replace("/", " ") ??
    ua.match(/Edg\/(\d+)/)?.[0].replace("Edg/", "Edge ") ??
    ua.match(/Firefox\/(\d+)/)?.[0].replace("/", " ") ??
    ua.match(/Chrome\/(\d+)/)?.[0].replace("/", " ") ??
    (/Safari/.test(ua) ? `Safari ${ua.match(/Version\/(\d+)/)?.[1] ?? ""}`.trim() : null);
  return [os, browser].filter(Boolean).join(", ");
}

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  if (!(await getProfile())?.is_admin) notFound();

  const asked = (await searchParams).filtro;
  const filter: Filter = asked === "todos" || asked === "teste" ? asked : "abertos";
  const admin = createAdminClient();
  let query = admin.from("error_logs").select("*").order("created_at", { ascending: false }).limit(500);
  query = filter === "teste" ? query.neq("env", "production") : query.eq("env", "production");
  if (filter === "abertos") query = query.is("resolved_at", null);
  const { data, error } = await query;
  const logs = (data ?? []) as ErrorLog[];

  // Agrupa por área e mensagem: o mesmo problema aparece uma vez, com a contagem.
  const groups = new Map<string, ErrorLog[]>();
  for (const log of logs) {
    const key = `${log.scope}\u0000${log.message}`;
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }

  // E-mail de quem foi afetado, para poder falar com a pessoa.
  const userIds = [...new Set(logs.map((l) => l.user_id).filter((id): id is string => Boolean(id)))].slice(0, 100);
  const emails = new Map(
    await Promise.all(
      userIds.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? id] as const),
    ),
  );

  return (
    <>
      <h1 className="display-md text-3xl">Erros do site</h1>
      <nav aria-label="Filtrar erros" className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/erros?filtro=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-outline"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error && <p className="alert alert-danger mt-6">Erro ao carregar o registro: {error.message}</p>}

      {groups.size === 0 ? (
        <p className="card mt-6 p-8 text-center text-lg text-ink-2">
          {filter === "abertos"
            ? "Nenhum erro em aberto no site."
            : filter === "teste"
              ? "Nenhum erro de teste local."
              : "Nenhum erro registrado no site."}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {[...groups.values()].map((items) => {
            const last = items[0];
            const first = items[items.length - 1];
            const users = new Set(items.map((i) => i.user_id).filter(Boolean)).size;
            const open = items.some((i) => !i.resolved_at);
            return (
              <li key={last.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`badge ${last.level === "warning" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"}`}
                  >
                    {last.level === "warning" ? "Aviso" : "Erro"}
                  </span>
                  <span className="badge bg-paper text-ink">{last.scope}</span>
                  <span className="badge bg-paper text-ink-2">{last.source === "client" ? "navegador" : "servidor"}</span>
                  {items.every((i) => i.env !== "production") && (
                    <span className="badge bg-action-soft text-action-strong">teste</span>
                  )}
                  {!open && <span className="badge bg-success-soft text-success">resolvido</span>}
                </div>
                <p className="mt-2 font-bold break-words">{last.message}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {plural(items.length, "vez", "vezes")}
                  {users ? `, ${plural(users, "cliente", "clientes")}` : ""}. Última {formatDateTime(last.created_at)}
                  {items.length > 1 ? `, primeira ${formatDateTime(first.created_at)}` : ""}.
                </p>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-action">
                    Ver {items.length > 1 ? `as ${Math.min(items.length, 10)} mais recentes` : "detalhes"}
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {items.slice(0, 10).map((item) => (
                      <li key={item.id} className="rounded-control border border-rule p-3 text-sm">
                        <p className="font-semibold tabular-nums">{formatDateTime(item.created_at)}</p>
                        <dl className="mt-1 grid gap-x-3 gap-y-0.5 sm:grid-cols-[7rem_1fr]">
                          {item.url && (
                            <>
                              <dt className="text-ink-2">Página</dt>
                              <dd className="break-all">{item.url}</dd>
                            </>
                          )}
                          {item.user_id && (
                            <>
                              <dt className="text-ink-2">Cliente</dt>
                              <dd className="break-all">{emails.get(item.user_id) ?? item.user_id}</dd>
                            </>
                          )}
                          {item.user_agent && (
                            <>
                              <dt className="text-ink-2">Aparelho</dt>
                              <dd title={item.user_agent}>{device(item.user_agent)}</dd>
                            </>
                          )}
                        </dl>
                        {item.detail && (
                          <pre className="mt-2 max-h-64 overflow-auto rounded-control bg-paper p-2 text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(item.detail, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>

                {open && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <ResolveErrorButton scope={last.scope} message={last.message} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
