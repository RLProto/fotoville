import type { Parcel, Product } from "../types";

/**
 * Estimativa de peso e volume do pacote a partir do pedido.
 *
 * Papel fotográfico (Kodak/Fuji) pesa em torno de 240-260 g/m² e tem ~0,25 mm.
 * Uma foto 10x15 dá 0,015 m² x 250 = 3,75 g. As fotos vão empilhadas, na horizontal,
 * em embalagem rígida do tamanho da maior foto do pedido.
 * Ajuste as constantes depois de pesar alguns pedidos reais.
 */

export const PAPER_GSM = 250;
export const PAPER_THICKNESS_MM = 0.25;

/** Envelope rígido: fotos até 20x30 e pilha baixa. Caixa: o resto. */
const ENVELOPE = { base_g: 60, max_stack_cm: 1.5, max_side_cm: 31 };
const BOX = { base_g: 150, padding_cm: 1 };
const PROTECTION_FACTOR = 1.08; // papelão/plástico de proteção cresce com o conteúdo
const MARGIN_CM = 2;

/** Limites dos Correios para pacote (cm). */
const MIN = { length: 16, width: 11, height: 2 };
const MAX_SIDE = 100;

export type ParcelItem = Pick<Product, "width_cm" | "height_cm" | "unit_weight_g" | "unit_thickness_mm"> & {
  quantity: number;
};

export function unitWeightG(p: Pick<Product, "width_cm" | "height_cm" | "unit_weight_g">) {
  return p.unit_weight_g ?? (p.width_cm / 100) * (p.height_cm / 100) * PAPER_GSM;
}

export function estimateParcel(items: ParcelItem[]): Parcel {
  let contentG = 0;
  let stackMm = 0;
  let longest = 0;
  let shortest = 0;

  for (const item of items) {
    if (item.quantity <= 0) continue;
    contentG += unitWeightG(item) * item.quantity;
    stackMm += (item.unit_thickness_mm ?? PAPER_THICKNESS_MM) * item.quantity;
    longest = Math.max(longest, item.width_cm, item.height_cm);
    shortest = Math.max(shortest, Math.min(item.width_cm, item.height_cm));
  }

  const stackCm = stackMm / 10;
  const envelope = stackCm <= ENVELOPE.max_stack_cm && longest <= ENVELOPE.max_side_cm;
  const packagingG = envelope ? ENVELOPE.base_g : BOX.base_g;
  const weight = contentG * PROTECTION_FACTOR + packagingG;
  const height = envelope ? stackCm + 0.5 : stackCm + 2 * BOX.padding_cm;

  return {
    // arredonda para cima em passos de 10 g
    weight_g: Math.max(50, Math.ceil(weight / 10) * 10),
    length_cm: clamp(Math.ceil(longest + MARGIN_CM), MIN.length, MAX_SIDE),
    width_cm: clamp(Math.ceil(shortest + MARGIN_CM), MIN.width, MAX_SIDE),
    height_cm: clamp(Math.ceil(height), MIN.height, MAX_SIDE),
  };
}

/** Peso que os Correios cobram: o cúbico só entra quando passa de 5 kg. */
export function billableWeightG(parcel: Parcel) {
  const cubicG = ((parcel.length_cm * parcel.width_cm * parcel.height_cm) / 6000) * 1000;
  return cubicG > 5000 ? Math.max(cubicG, parcel.weight_g) : parcel.weight_g;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
