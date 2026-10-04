import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, reportServerError, requireUser, serverFail } from "@/lib/api";
import { getPackages } from "@/lib/catalog";
import { createPreference, hasMercadoPago } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

const schema = z.object({ packageId: z.string() });

/** Compra de pacote pré-pago ("compre agora, revele depois"). Sem frete: vira cupom ao pagar. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Pacote inválido.");

  const pkg = (await getPackages()).find((p) => p.id === parsed.data.packageId);
  if (!pkg) return fail("Pacote não encontrado.", 404);

  const admin = createAdminClient();
  // Pacote não passa pelo formulário de entrega: nome, WhatsApp e CPF vêm do cadastro
  const { data: profile } = await admin.from("profiles").select("full_name, whatsapp, cpf").eq("id", user.id).maybeSingle();
  const customer = {
    name: profile?.full_name || user.user_metadata?.full_name || undefined,
    whatsapp: profile?.whatsapp || undefined,
    cpf: profile?.cpf || undefined,
    email: user.email,
  };

  const { data: created, error } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      kind: "package",
      package_id: pkg.id,
      subtotal_cents: pkg.price_cents,
      total_cents: pkg.price_cents,
      customer,
    })
    .select("*")
    .single();
  if (error || !created) return serverFail("checkout", "Não foi possível criar o pedido. Tente de novo ou fale com a gente pelo WhatsApp.", error, 500, { package: pkg.id });
  const order = created as Order;

  await admin.from("order_items").insert({
    order_id: order.id,
    product_id: pkg.product_id,
    description: `Pacote ${pkg.name}`,
    quantity: 1,
    unit_price_cents: pkg.price_cents,
    total_cents: pkg.price_cents,
  });

  const orderUrl = `/pedido/${order.id}`;
  if (!hasMercadoPago) return NextResponse.json({ orderId: order.id, redirect: `${orderUrl}?semPagamento=1` });

  try {
    const preference = await createPreference({
      id: order.id,
      number: order.number,
      total_cents: pkg.price_cents,
      title: `Fotoville - Pacote ${pkg.name}`,
      payerEmail: user.email,
    });
    await admin
      .from("orders")
      .update({ mp_preference_id: preference.id, mp_init_point: preference.init_point })
      .eq("id", order.id);
    return NextResponse.json({ orderId: order.id, redirect: preference.init_point });
  } catch (err) {
    reportServerError("pagamento", err, { order: order.id, etapa: "preferência do Mercado Pago (pacote)" });
    return NextResponse.json({ orderId: order.id, redirect: `${orderUrl}?erroPagamento=1` });
  }
}
