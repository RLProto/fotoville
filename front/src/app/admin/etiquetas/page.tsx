import { notFound, redirect } from "next/navigation";
import { LabelBatches } from "@/components/admin/label-batches";
import { BATCHES_PER_PAGE, loadBatches } from "@/lib/label-batches";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  const page = Math.max(1, Math.floor(Number((await searchParams).pagina)) || 1);
  let data: Awaited<ReturnType<typeof loadBatches>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBatches(createAdminClient(), page);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / BATCHES_PER_PAGE));
  // Página que deixou de existir (lote desfeito, endereço antigo): vai para a última
  if (data && page > pageCount) redirect(pageCount > 1 ? `/admin/etiquetas?pagina=${pageCount}` : "/admin/etiquetas");

  // Com erro, nada de lista: etiqueta sem os tamanhos não pode ir para o PDF
  return data ? (
    <LabelBatches
      batches={data.batches}
      waiting={data.waiting}
      page={{ current: page, count: pageCount, total: data.total, first: (page - 1) * BATCHES_PER_PAGE + 1 }}
    />
  ) : (
    <>
      <h1 className="display-md text-3xl">Etiquetas</h1>
      <p className="alert alert-danger mt-6">Erro ao carregar etiquetas: {error}</p>
    </>
  );
}
