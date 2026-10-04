import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { PACKAGES, PRODUCTS } from "./catalog-data";
import { logError } from "./error-log";
import { parseTiers } from "./pricing";
import { hasSupabase } from "./site";
import type { Package, Product } from "./types";

function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Produtos ativos. Sem Supabase configurado, usa o catálogo de referência. */
export const getProducts = cache(async (): Promise<Product[]> => {
  if (!hasSupabase) return PRODUCTS;
  const { data, error } = await publicClient()
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort");
  if (error || !data?.length) {
    if (error) await logError({ source: "server", scope: "catalogo", message: error.message, detail: { tabela: "products" } });
    return PRODUCTS;
  }
  return data.map((p) => ({
    ...p,
    // Banco ainda sem a coluna price_tiers: usa as faixas do catálogo de referência
    price_tiers: parseTiers(p.price_tiers === undefined ? PRODUCTS.find((r) => r.id === p.id)?.price_tiers : p.price_tiers),
    width_cm: Number(p.width_cm),
    height_cm: Number(p.height_cm),
    unit_weight_g: p.unit_weight_g === null ? null : Number(p.unit_weight_g),
    unit_thickness_mm: p.unit_thickness_mm === null ? null : Number(p.unit_thickness_mm),
  })) as Product[];
});

export async function getProduct(id: string) {
  return (await getProducts()).find((p) => p.id === id) ?? null;
}

export const getPackages = cache(async (): Promise<Package[]> => {
  if (!hasSupabase) return PACKAGES;
  const { data, error } = await publicClient()
    .from("packages")
    .select("*")
    .eq("active", true)
    .order("sort");
  if (error || !data?.length) {
    if (error) await logError({ source: "server", scope: "catalogo", message: error.message, detail: { tabela: "packages" } });
    return PACKAGES;
  }
  return data as Package[];
});
