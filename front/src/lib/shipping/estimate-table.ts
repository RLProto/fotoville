import type { Parcel } from "../types";
import { billableWeightG } from "./parcel.ts";

/**
 * Tabela de estimativa usada quando a API dos Correios não está configurada ou falha.
 * Valores aproximados de balcão saindo de Joinville/SC. Não substitui a cotação real:
 * o checkout avisa o cliente que o frete é estimado.
 */

type Zone = "local" | "estado" | "sul" | "sudeste" | "centro" | "nordeste" | "norte";

const TABLE: Record<Zone, { pac: [base: number, perKg: number, days: number]; sedex: [number, number, number] }> = {
  //            PAC: base até 300 g, por kg extra, prazo     SEDEX
  local:    { pac: [1890, 250, 3],  sedex: [2290, 350, 1] },
  estado:   { pac: [2190, 300, 4],  sedex: [2890, 500, 2] },
  sul:      { pac: [2490, 350, 5],  sedex: [3490, 700, 2] },
  sudeste:  { pac: [2790, 450, 6],  sedex: [4290, 1100, 2] },
  centro:   { pac: [3190, 600, 8],  sedex: [5690, 1600, 3] },
  nordeste: { pac: [3690, 800, 11], sedex: [7490, 2300, 4] },
  norte:    { pac: [4190, 950, 14], sedex: [8990, 2900, 6] },
};

function zoneOf(cep: string): Zone {
  const prefix3 = Number(cep.slice(0, 3));
  const first = cep[0];
  if (prefix3 >= 892 && prefix3 <= 892) return "local"; // Joinville
  if (cep.startsWith("88") || cep.startsWith("89")) return "estado";
  if (first === "8" || first === "9") return "sul";
  if (first === "0" || first === "1" || first === "2" || first === "3") return "sudeste";
  if (first === "7") return prefix3 >= 768 && prefix3 <= 769 ? "norte" : "centro"; // 76 8xx-9xx = RO
  if (first === "4" || first === "5") return "nordeste";
  // 6xxxx: CE, PI, MA (nordeste) e PA, AP, AM, RR, AC (norte)
  return prefix3 >= 660 ? "norte" : "nordeste";
}

export function estimateFromTable(service: "pac" | "sedex", cepDestino: string, parcel: Parcel) {
  const [base, perKg, days] = TABLE[zoneOf(cepDestino)][service];
  const extraKg = Math.max(0, Math.ceil((billableWeightG(parcel) - 300) / 1000));
  return { price_cents: base + extraKg * perKg, days };
}
