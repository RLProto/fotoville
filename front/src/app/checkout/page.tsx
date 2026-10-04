import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { OrderSteps } from "@/components/order-steps";
import { belowMinimum, loadCartPhotos, summarizeCart } from "@/lib/cart";
import { getProducts } from "@/lib/catalog";
import { site } from "@/lib/site";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Entrega e pagamento" };

export default async function CheckoutPage() {
  const user = await getUser();
  if (!user) redirect("/entrar?proximo=/checkout");

  const [photos, products, profile] = await Promise.all([
    loadCartPhotos(await createClient(), user.id),
    getProducts(),
    getProfile(),
  ]);
  const cart = summarizeCart(photos, products);
  // Carrinho vazio ou com tamanho abaixo do mínimo: o carrinho mostra o que falta
  if (!cart.lines.length || belowMinimum(cart.lines).length) redirect("/carrinho");

  return (
    <div className="container-page py-8">
      <Link href="/carrinho" className="inline-flex min-h-11 items-center gap-1 font-semibold text-action hover:underline">
        <CaretLeftIcon size={18} aria-hidden />
        Voltar ao carrinho
      </Link>
      <OrderSteps current={4} className="mt-2" />
      <h1 className="mt-3 mb-8 display-md text-3xl sm:text-4xl">Entrega e pagamento</h1>

      <CheckoutForm
        lines={cart.lines.map((l) => ({
          key: `${l.product.id}-${l.finish}`,
          label: `${l.quantity}× ${l.description}`,
          total_cents: l.total_cents,
        }))}
        subtotalCents={cart.subtotal_cents}
        productionDays={site.productionDays}
        pickupAddress={`${site.address.street}, ${site.address.district}, ${site.address.city}/${site.address.state}`}
        initial={{
          name: profile?.full_name ?? "",
          cpf: profile?.cpf ?? "",
          whatsapp: profile?.whatsapp ?? "",
        }}
      />
    </div>
  );
}
