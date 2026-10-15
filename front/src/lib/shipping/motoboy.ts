import "server-only";
import { createAdminClient } from "../supabase/server";
import type { ShippingOption } from "../types";
import { districtKey } from "./district";

export type MotoboyZone = { id: string; district: string; district_key: string; price_cents: number; active: boolean };

/** Cidade atendida pelo motoboy. */
export const MOTOBOY_CITY = "Joinville";

/** Bairros com entrega por motoboy, como estão no banco (inclusive os desativados, para o painel). */
export async function loadMotoboyZones(): Promise<MotoboyZone[]> {
  const { data } = await createAdminClient().from("motoboy_zones").select("*").order("district");
  return (data ?? []) as MotoboyZone[];
}

/**
 * Opção de motoboy para um endereço, ou null quando a cidade não é Joinville ou o bairro
 * não está na lista. O bairro é comparado sem acento nem maiúsculas.
 */
export function motoboyOption(
  place: { district?: string | null; city?: string | null },
  zones: MotoboyZone[],
): ShippingOption | null {
  if (districtKey(place.city ?? "") !== districtKey(MOTOBOY_CITY)) return null;
  const key = districtKey(place.district ?? "");
  if (!key) return null;
  const zone = zones.find((z) => z.active && z.district_key === key);
  if (!zone) return null;
  return {
    service: "motoboy",
    label: `Motoboy (${zone.district}, ${MOTOBOY_CITY})`,
    price_cents: zone.price_cents,
    days: 1,
    estimated: false,
  };
}
