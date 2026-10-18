import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, reportServerError, requireUser, serverFail } from "@/lib/api";
import { belowMinimum, type CartCount, countCart, loadCartPhotos, sameCount, summarizeCart } from "@/lib/cart";
import { getChargeProducts } from "@/lib/catalog";
import { percentDiscount } from "@/lib/coupon-rules";
import {
  type CouponProblem,
  couponProblemMessage,
  previewCoupon,
  recordCouponMiss,
  TOO_MANY_MISSES,
  tooManyCouponMisses,
} from "@/lib/coupons";
import { isValidCpf, onlyDigits } from "@/lib/format";
import { createPreference, hasMercadoPago } from "@/lib/mercadopago";
import { markOrderPaid } from "@/lib/orders";
import { quoteShipping } from "@/lib/shipping";
import { estimateParcel } from "@/lib/shipping/parcel";
import { createAdminClient } from "@/lib/supabase/server";
import type { Coupon, Order, Photo } from "@/lib/types";

const schema = z.object({
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    cpf: z.string(),
    whatsapp: z.string(),
  }),
  service: z.enum(["pac", "sedex", "motoboy", "retirada"]),
  address: z
    .object({
      cep: z.string(),
      street: z.string().trim().min(2).max(160),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(80).optional(),
      district: z.string().trim().min(2).max(80),
      city: z.string().trim().min(2).max(80),
      state: z.string().trim().length(2),
    })
    .optional(),
  coupon: z.string().max(40).optional(),
});

/** Fecha o carrinho: cria o pedido, reserva o cupom e devolve o link de pagamento. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Confira os dados preenchidos.");
  const input = parsed.data;

  const cpf = onlyDigits(input.customer.cpf);
  const whatsapp = onlyDigits(input.customer.whatsapp);
  if (!isValidCpf(cpf)) return fail("CPF inválido. Confira os 11 dígitos.");
  if (whatsapp.length < 10) return fail("Informe o WhatsApp com DDD.");

  const delivery = input.service !== "retirada";
  const cep = onlyDigits(input.address?.cep ?? "");
  if (delivery && (!input.address || cep.length !== 8)) return fail("Informe o endereço de entrega completo.");

  // Tudo que envolve dinheiro é recalculado aqui, a partir do banco. Sem banco, não cobra.
  let loaded: [Photo[], Awaited<ReturnType<typeof getChargeProducts>>];
  try {
    loaded = await Promise.all([loadCartPhotos(supabase, user.id), getChargeProducts(user.id)]);
  } catch (err) {
    return serverFail("checkout", "Não foi possível carregar o carrinho agora. Tente de novo em instantes.", err, 503, { etapa: "carrinho e preços" });
  }
  const [photos, { products, profile }] = loaded;
  const cart = summarizeCart(photos, products);
  if (!cart.lines.length) return fail("Seu carrinho está vazio.");
  const short = belowMinimum(cart.lines)[0];
  if (short) {
    return fail(`${short.product.name}: mínimo de ${short.min} fotos. Adicione mais ${short.min - short.copies}.`, 422);
  }

  const admin = createAdminClient();
  const parcel = estimateParcel(cart.parcelItems);

  let shipping = { service: "retirada", label: "Retirar na loja", price_cents: 0, days: 0, estimated: false };
  if (delivery) {
    try {
      const option = (await quoteShipping(cep, parcel, input.address)).find((o) => o.service === input.service);
      if (!option) {
        return fail(
          input.service === "motoboy"
            ? "O motoboy não atende este bairro. Confira o bairro ou escolha outra entrega."
            : "Esta opção de entrega não está disponível para este CEP. Escolha outra.",
        );
      }
      shipping = option;
    } catch (err) {
      return serverFail("frete", "Não foi possível calcular o frete agora. Tente de novo em instantes.", err, 502, { cep });
    }
  }

  let discount_cents = 0;
  let coupon: { code: string; credits: number; kind: string } | null = null;
  if (input.coupon?.trim()) {
    const ip = clientIp(request);
    if (await tooManyCouponMisses(admin, user.id, ip)) return fail(TOO_MANY_MISSES, 429);
    let result;
    try {
      result = await previewCoupon(admin, input.coupon, cart.lines, user.id);
    } catch (err) {
      return serverFail("checkout", "Não foi possível conferir o cupom agora. Tente de novo.", err, 500, { etapa: "conferir cupom" });
    }
    if (!result.ok) {
      if (result.miss) await recordCouponMiss(admin, user.id, ip);
      return fail(result.message, 422);
    }
    // Cupom percentual desconta o pedido inteiro, frete incluído; o de créditos cobre só fotos
    discount_cents =
      result.percent_off !== null
        ? percentDiscount(cart.subtotal_cents + shipping.price_cents, result.percent_off)
        : Math.min(result.discount_cents, cart.subtotal_cents);
    coupon = { code: result.code, credits: result.credits, kind: result.kind };
  }

  const total_cents = cart.subtotal_cents - discount_cents + shipping.price_cents;

  const { data: created, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      kind: "prints",
      subtotal_cents: cart.subtotal_cents,
      discount_cents,
      shipping_cents: shipping.price_cents,
      total_cents,
      coupon_code: coupon?.code ?? null,
      customer: { name: input.customer.name, cpf, whatsapp, email: user.email },
      // Com que tabela o pedido foi cobrado (perfil de cliente preferencial), para o painel
      price_profile_name: profile?.name ?? null,
      shipping_service: shipping.service,
      shipping_label: shipping.label,
      shipping_days: shipping.days,
      shipping_estimated: shipping.estimated,
      shipping_address: delivery ? { ...input.address, cep } : null,
      parcel,
    })
    .select("*")
    .single();
  if (orderError || !created) return serverFail("checkout", "Não foi possível criar o pedido. Tente de novo ou fale com a gente pelo WhatsApp.", orderError);
  const order = created as Order;

  const rollback = async () => {
    await admin.from("photos").update({ order_id: null }).eq("order_id", order.id);
    await admin.from("orders").delete().eq("id", order.id);
  };

  // Liga as fotos ao pedido numa operação só e confere com o que foi cobrado. Se o carrinho mudou no meio
  // (cópias alteradas, foto nova ou o pedido fechado em outra aba), desfaz: o cliente confere e tenta de novo.
  const { data: linked, error: linkError } = await admin.rpc("claim_cart_photos", { p_order: order.id, p_user: user.id });
  if (linkError) {
    await rollback();
    return serverFail("checkout", "Não foi possível criar o pedido. Tente de novo ou fale com a gente pelo WhatsApp.", linkError, 500, {
      order: order.id,
      etapa: "vincular fotos",
    });
  }
  if (!sameCount(countCart(photos, products), (linked ?? []) as CartCount[])) {
    await rollback();
    return fail("Seu carrinho mudou enquanto o pedido era criado. Confira o carrinho e tente de novo.", 409);
  }

  // Créditos do cupom são consumidos de forma atômica: dois pedidos não gastam o mesmo saldo.
  if (coupon?.kind === "credits" && coupon.credits > 0) {
    const { data: redeemed } = await admin.rpc("redeem_coupon_credits", {
      p_code: coupon.code,
      p_credits: coupon.credits,
    });
    if (!redeemed) {
      await rollback();
      return fail("O saldo do cupom mudou. Aplique o cupom de novo.", 409);
    }
  }
  if (coupon?.kind === "percent") {
    // Confere de novo e registra o uso com o cupom travado: dois pedidos ao mesmo tempo não passam do limite
    const { data: problem, error } = await admin.rpc("redeem_percent_coupon", {
      p_code: coupon.code,
      p_order: order.id,
      p_subtotal: cart.subtotal_cents,
      p_discount: discount_cents,
    });
    if (error || problem) {
      await rollback();
      if (error) return serverFail("checkout", "Não foi possível usar o cupom agora. Tente de novo.", error, 500, { etapa: "registrar cupom" });
      const { data: row } = await admin.from("coupons").select("*").eq("code", coupon.code).maybeSingle();
      return fail(couponProblemMessage(problem as CouponProblem, row as Coupon | null), 409);
    }
  } else if (coupon) {
    await admin
      .from("coupon_redemptions")
      .insert({ code: coupon.code, order_id: order.id, credits: coupon.credits, discount_cents });
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    cart.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      description: l.description,
      finish: l.finish,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      total_cents: l.total_cents,
    })),
  );
  if (itemsError) {
    if (coupon?.kind === "credits" && coupon.credits > 0) {
      await admin.rpc("redeem_coupon_credits", { p_code: coupon.code, p_credits: -coupon.credits });
    }
    await rollback();
    return serverFail("checkout", "Não foi possível criar o pedido. Tente de novo ou fale com a gente pelo WhatsApp.", itemsError, 500, {
      order: order.id,
      etapa: "itens do pedido",
    });
  }

  await admin.from("profiles").update({ full_name: input.customer.name, cpf, whatsapp }).eq("id", user.id);

  const orderUrl = `/pedido/${order.id}`;

  // Pedido coberto inteiro pelo cupom: não há o que pagar.
  if (total_cents === 0) {
    await markOrderPaid(admin, order.id, { id: null, method: "cupom" });
    return NextResponse.json({ orderId: order.id, redirect: orderUrl });
  }

  if (!hasMercadoPago) {
    // Ambiente sem Mercado Pago: o pedido fica aguardando pagamento.
    return NextResponse.json({ orderId: order.id, redirect: `${orderUrl}?semPagamento=1` });
  }

  try {
    const preference = await createPreference({
      id: order.id,
      number: order.number,
      total_cents,
      title: `Pedido Fotoville #${order.number} (${cart.photo_count} fotos)`,
      payerEmail: user.email,
    });
    await admin
      .from("orders")
      .update({ mp_preference_id: preference.id, mp_init_point: preference.init_point })
      .eq("id", order.id);
    return NextResponse.json({ orderId: order.id, redirect: preference.init_point });
  } catch (err) {
    reportServerError("pagamento", err, { order: order.id, etapa: "preferência do Mercado Pago" });
    // O pedido já existe; o cliente pode tentar pagar de novo pela página do pedido.
    return NextResponse.json({ orderId: order.id, redirect: `${orderUrl}?erroPagamento=1` });
  }
}
