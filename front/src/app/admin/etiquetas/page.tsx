import { notFound } from "next/navigation";
import { LabelBatches } from "@/components/admin/label-batches";
import { loadBatches } from "@/lib/label-batches";
import { createAdminClient, getProfile } from "@/lib/supabase/server";

export default async function LabelsPage() {
  // O layout já barra quem não é admin; a checagem se repete porque aqui se usa a service role.
  if (!(await getProfile())?.is_admin) notFound();

  let data: Awaited<ReturnType<typeof loadBatches>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBatches(createAdminClient());
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Com erro, nada de lista: etiqueta sem os tamanhos não pode ir para o PDF
  return data ? (
    <LabelBatches batches={data.batches} waiting={data.waiting} />
  ) : (
    <>
      <h1 className="display-md text-3xl">Etiquetas</h1>
      <p className="alert alert-danger mt-6">Erro ao carregar etiquetas: {error}</p>
    </>
  );
}
