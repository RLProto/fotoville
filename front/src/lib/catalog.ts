import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { PACKAGES, PRODUCTS } from "./catalog-data";
import { logError } from "./error-log";
import { activeTiers, alignTiers, parseTiers } from "./pricing";
import { hasSupabase } from "./site";
import { createAdminClient, getUser } from "./supabase/server";
import type { CustomerPriceProfile, Package, Product } from "./types";

function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const fetchStoreProducts = () => publicClient().from("products").select("*").eq("active", true).order("sort");

function toProducts(rows: Record<string, unknown>[]): Product[] {
  return rows.map((p) => ({
    ...p,
    // Banco ainda sem a coluna price_tiers: usa as faixas do catálogo de referência
    price_tiers: parseTiers(p.price_tiers === undefined ? PRODUCTS.find((r) => r.id === p.id)?.price_tiers : p.price_tiers),
    width_cm: Number(p.width_cm),
    height_cm: Number(p.height_cm),
    unit_weight_g: p.unit_weight_g === null ? null : Number(p.unit_weight_g),
    unit_thickness_mm: p.unit_thickness_mm === null ? null : Number(p.unit_thickness_mm),
  })) as Product[];
}

/** Produtos ativos com os preços da loja. Sem Supabase configurado, usa o catálogo de referência. */
export const getStoreProducts = cache(async (): Promise<Product[]> => {
  if (!hasSupabase) return PRODUCTS;
  const { data, error } = await fetchStoreProducts();
  if (error || !data?.length) {
    if (error) await logError({ source: "server", scope: "catalogo", message: error.message, detail: { tabela: "products" } });
    return PRODUCTS;
  }
  return toProducts(data);
});

/**
 * Perfil de preço de um cliente e a tabela dele. Só o servidor lê (RLS sem políticas).
 * Com `strict`, falha do banco vira erro em vez de "sem perfil" (para cobrar, não para mostrar).
 */
export async function loadPriceProfileFor(userId: string, { strict = false } = {}): Promise<CustomerPriceProfile | null> {
  if (!hasSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("customer_price_profiles")
    .select("profile_id, price_profiles(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (strict) throw new Error(`Perfil de preço indisponível: ${error.message}`);
    await logError({ source: "server", scope: "catalogo", message: error.message, detail: { tabela: "customer_price_profiles" } });
    return null;
  }
  if (!link) return null;
  const { data: rows, error: rowsError } = await admin
    .from("profile_prices")
    .select("product_id, price_cents, price_tiers")
    .eq("profile_id", link.profile_id);
  if (rowsError && strict) throw new Error(`Tabela do perfil indisponível: ${rowsError.message}`);
  const joined = link.price_profiles as unknown as { name: string } | { name: string }[] | null;
  const name = (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? "Perfil";
  return {
    id: link.profile_id,
    name,
    prices: new Map((rows ?? []).map((r) => [r.product_id, { price_cents: r.price_cents, price_tiers: parseTiers(r.price_tiers) }])),
  };
}

/** Perfil de preço do cliente logado, ou null. */
export const getCustomerPriceProfile = cache(async (): Promise<CustomerPriceProfile | null> => {
  const user = await getUser().catch(() => null);
  return user ? loadPriceProfileFor(user.id) : null;
});

/**
 * Põe a tabela do perfil por cima da tabela da loja. Tamanho sem preço no perfil fica com o da loja.
 * As faixas do perfil seguem as quantidades da loja (1, 20, 50...): o perfil só muda o preço de cada faixa.
 * Faixa desligada no perfil (mesmo preço da anterior) não aparece para o cliente.
 */
export function applyPriceProfile(products: Product[], profile: CustomerPriceProfile | null): Product[] {
  if (!profile) return products;
  return products.map((p) => {
    const own = profile.prices.get(p.id);
    if (!own) return p;
    return {
      ...p,
      price_cents: own.price_cents,
      price_tiers: activeTiers({ price_cents: own.price_cents, price_tiers: alignTiers(own, p.price_tiers) }),
      store: { price_cents: p.price_cents, price_tiers: p.price_tiers },
    };
  });
}

/**
 * Produtos com os preços de quem está navegando: a tabela da loja ou, para cliente com perfil, a do perfil.
 * Tudo que mostra ou cobra preço passa por aqui (páginas, carrinho, frete, cupom, pagamento).
 */
export const getProducts = cache(async (): Promise<Product[]> => {
  const [store, profile] = await Promise.all([getStoreProducts(), getCustomerPriceProfile()]);
  return applyPriceProfile(store, profile);
});

export async function getProduct(id: string) {
  return (await getProducts()).find((p) => p.id === id) ?? null;
}

/**
 * Preços para cobrar o cliente: os mesmos de getProducts, mas sem o catálogo de referência do código.
 * Se o banco falhar, a cobrança falha, em vez de usar um preço fixo que pode estar desatualizado.
 */
export async function getChargeProducts(userId: string): Promise<{ products: Product[]; profile: CustomerPriceProfile | null }> {
  const [{ data, error }, profile] = await Promise.all([fetchStoreProducts(), loadPriceProfileFor(userId, { strict: true })]);
  if (error) throw new Error(`Catálogo indisponível: ${error.message}`);
  if (!data?.length) throw new Error("Catálogo vazio no banco");
  return { products: applyPriceProfile(toProducts(data), profile), profile };
}

/** Pacote ativo para cobrar, direto do banco (sem o catálogo de referência). null quando não existe. */
export async function getChargePackage(id: string): Promise<Package | null> {
  const { data, error } = await publicClient().from("packages").select("*").eq("id", id).eq("active", true).maybeSingle();
  if (error) throw new Error(`Pacotes indisponíveis: ${error.message}`);
  return data as Package | null;
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
