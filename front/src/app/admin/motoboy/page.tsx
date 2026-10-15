import { notFound } from "next/navigation";
import { MotoboyZonesEditor } from "@/components/admin/motoboy-zones-editor";
import { formatBRL } from "@/lib/format";
import { loadMotoboyZones, MOTOBOY_CITY } from "@/lib/shipping/motoboy";
import { getProfile } from "@/lib/supabase/server";

/** Preço padrão para um bairro novo. */
const DEFAULT_CENTS = 1990;

export default async function MotoboyPage() {
  if (!(await getProfile())?.is_admin) notFound();
  const zones = await loadMotoboyZones();

  return (
    <>
      <h1 className="display-md text-3xl">Motoboy</h1>
      <p className="mt-2 max-w-[60ch] text-ink-2">
        Entrega por motoboy só em {MOTOBOY_CITY}, nos bairros desta lista. O cliente vê a opção quando o bairro do
        endereço bate com um bairro ativo. Bairro novo entra a {formatBRL(DEFAULT_CENTS)}; o preço de cada um pode
        ser diferente.
      </p>
      <div className="mt-6">
        <MotoboyZonesEditor
          initial={zones.map((z) => ({ id: z.id, district: z.district, price_cents: z.price_cents, active: z.active }))}
          defaultCents={DEFAULT_CENTS}
        />
      </div>
    </>
  );
}
