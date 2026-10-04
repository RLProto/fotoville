import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unitPrice } from "./pricing";
import type { ParcelItem } from "./shipping/parcel";
import { FINISH_LABEL, type Finish, type Photo, type Product } from "./types";

export type CartLine = {
  product: Product;
  finish: Finish;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  description: string;
};

export type CartSummary = {
  lines: CartLine[];
  subtotal_cents: number;
  photo_count: number; // cópias
  file_count: number; // arquivos enviados
  parcelItems: ParcelItem[];
};

export async function loadCartPhotos(supabase: SupabaseClient, userId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", userId)
    .is("order_id", null)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Photo[];
}

/**
 * Agrupa as fotos por tamanho e acabamento. Preço sempre do catálogo do servidor, com o desconto
 * da faixa alcançada pelo total de cópias do tamanho (brilho e fosco somam juntos).
 */
export function summarizeCart(photos: Photo[], products: Product[]): CartSummary {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = new Map<string, CartLine>();
  const copiesByProduct = new Map<string, number>();

  for (const photo of photos) {
    const product = byId.get(photo.product_id);
    if (!product) continue; // produto desativado: fica fora do pedido
    const finish = product.finishes.includes(photo.finish) ? photo.finish : product.finishes[0];
    const key = `${product.id}:${finish}`;
    const line =
      lines.get(key) ??
      ({
        product,
        finish,
        quantity: 0,
        unit_price_cents: product.price_cents,
        total_cents: 0,
        description: product.finishes.length > 1 ? `${product.name}, ${FINISH_LABEL[finish].toLowerCase()}` : product.name,
      } satisfies CartLine);
    line.quantity += photo.quantity;
    lines.set(key, line);
    copiesByProduct.set(product.id, (copiesByProduct.get(product.id) ?? 0) + photo.quantity);
  }

  for (const line of lines.values()) {
    line.unit_price_cents = unitPrice(line.product, copiesByProduct.get(line.product.id) ?? line.quantity);
    line.total_cents = line.quantity * line.unit_price_cents;
  }

  const list = [...lines.values()].sort((a, b) => a.product.sort - b.product.sort);
  return {
    lines: list,
    subtotal_cents: list.reduce((sum, l) => sum + l.total_cents, 0),
    photo_count: list.reduce((sum, l) => sum + l.quantity, 0),
    file_count: photos.filter((p) => byId.has(p.product_id)).length,
    parcelItems: list.map((l) => ({
      width_cm: l.product.width_cm,
      height_cm: l.product.height_cm,
      unit_weight_g: l.product.unit_weight_g,
      unit_thickness_mm: l.product.unit_thickness_mm,
      quantity: l.quantity,
    })),
  };
}
