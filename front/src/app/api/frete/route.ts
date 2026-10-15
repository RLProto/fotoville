import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireUser, serverFail } from "@/lib/api";
import { loadCartPhotos, summarizeCart } from "@/lib/cart";
import { getProducts } from "@/lib/catalog";
import { onlyDigits } from "@/lib/format";
import { quoteShipping } from "@/lib/shipping";
import { estimateParcel } from "@/lib/shipping/parcel";

const schema = z.object({
  cep: z.string(),
  district: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
});

/** Cota o frete do carrinho atual para um CEP (e bairro, para o motoboy). Peso e volume são estimados pelo pedido. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const cep = onlyDigits(parsed.success ? parsed.data.cep : "");
  if (cep.length !== 8) return fail("Informe o CEP com 8 dígitos.");

  const [photos, products] = await Promise.all([loadCartPhotos(auth.supabase, auth.user.id), getProducts()]);
  const cart = summarizeCart(photos, products);
  if (!cart.lines.length) return fail("Seu carrinho está vazio.");

  const parcel = estimateParcel(cart.parcelItems);
  try {
    const place = parsed.success ? { district: parsed.data.district, city: parsed.data.city } : {};
    const options = await quoteShipping(cep, parcel, place);
    return NextResponse.json({ options, parcel });
  } catch (err) {
    return serverFail("frete", "Não foi possível calcular o frete agora. Tente de novo em instantes.", err, 502, { cep });
  }
}
