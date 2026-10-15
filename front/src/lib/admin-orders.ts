import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPhoto, OrderDownload } from "./admin-download";
import { PRODUCTS } from "./catalog-data";
import { hasStorage, presignDownload } from "./storage";
import type { Order, Photo, Product } from "./types";

/** Produtos como estão no banco, inclusive desativados (pedidos antigos apontam para eles). */
export async function loadAllProducts(admin: SupabaseClient): Promise<Product[]> {
  const { data } = await admin.from("products").select("*");
  return (
    data?.length ? data.map((p) => ({ ...p, width_cm: Number(p.width_cm), height_cm: Number(p.height_cm) })) : PRODUCTS
  ) as Product[];
}

/** Fotos do pedido com URL assinada do original e da miniatura, prontas para o download do painel. */
export async function loadOrderPhotos(admin: SupabaseClient, order: Order): Promise<AdminPhoto[]> {
  const { data } = await admin.from("photos").select("*").eq("order_id", order.id).order("product_id").order("created_at");
  const photos = (data ?? []) as Photo[];
  const gone = Boolean(order.photos_deleted_at) || !hasStorage;
  return Promise.all(
    photos.map(async (photo, i) => {
      const ext = photo.storage_key.split(".").pop() ?? "jpg";
      const base_name = `${order.number}_${photo.product_id}_${String(i + 1).padStart(3, "0")}`;
      return {
        ...photo,
        base_name,
        thumb_url: gone ? null : await presignDownload(photo.thumb_key ?? photo.storage_key),
        original_url: gone ? null : await presignDownload(photo.storage_key, { downloadName: `${base_name}_original.${ext}` }),
      };
    }),
  );
}

/** Tudo que o navegador do painel precisa para gravar o pedido em pastas. */
export async function loadOrderDownload(admin: SupabaseClient, order: Order): Promise<OrderDownload> {
  const [photos, products] = await Promise.all([loadOrderPhotos(admin, order), loadAllProducts(admin)]);
  return { order, photos, products };
}
