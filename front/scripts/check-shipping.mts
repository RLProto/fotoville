/**
 * Confere a estimativa de peso/volume e a tabela de frete com pedidos de exemplo.
 * Uso: npm run check:frete
 */
import { PRODUCTS } from "../src/lib/catalog-data.ts";
import { estimateFromTable } from "../src/lib/shipping/estimate-table.ts";
import { estimateParcel } from "../src/lib/shipping/parcel.ts";

const item = (id: string, quantity: number) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`produto ${id} não existe`);
  return { ...p, quantity };
};

const orders: [string, ReturnType<typeof item>[]][] = [
  ["20 fotos 10x15", [item("10x15", 20)]],
  ["100 fotos 10x15", [item("10x15", 100)]],
  ["500 fotos 10x15", [item("10x15", 500)]],
  ["1000 fotos 10x15", [item("10x15", 1000)]],
  ["3 ampliações 30x60", [item("30x60", 3)]],
  ["50x 10x15 + 2x 20x30 + 1 foto-placa", [item("10x15", 50), item("20x30", 2), item("foto-placa-20x30", 1)]],
];

const brl = (c: number) => `R$ ${(c / 100).toFixed(2)}`;

for (const [label, items] of orders) {
  const parcel = estimateParcel(items);
  const sp = estimateFromTable("pac", "01310100", parcel);
  const am = estimateFromTable("sedex", "69005010", parcel);
  console.log(
    `${label.padEnd(38)} ${String(parcel.weight_g).padStart(5)} g  ${parcel.length_cm}x${parcel.width_cm}x${parcel.height_cm} cm` +
      `  | PAC São Paulo ${brl(sp.price_cents)} (${sp.days}d)  SEDEX Manaus ${brl(am.price_cents)} (${am.days}d)`,
  );
}
