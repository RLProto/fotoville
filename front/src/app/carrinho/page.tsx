import { ImagesIcon, PencilSimpleIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderSteps } from "@/components/order-steps";
import { PrintPreview } from "@/components/print-preview";
import { RemoveGroupButton } from "@/components/remove-group-button";
import { loadCartPhotos, summarizeCart } from "@/lib/cart";
import { getProducts } from "@/lib/catalog";
import { formatBRL, plural } from "@/lib/format";
import { nearTier, unitPrice } from "@/lib/pricing";
import { withThumbUrls } from "@/lib/storage";
import { createClient, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Carrinho" };

const PREVIEW_LIMIT = 6;

export default async function CarrinhoPage() {
  const user = await getUser();
  if (!user) redirect("/entrar?proximo=/carrinho");

  const [photos, products] = await Promise.all([loadCartPhotos(await createClient(), user.id), getProducts()]);
  const cart = summarizeCart(photos, products);

  if (!cart.lines.length) {
    return (
      <div className="container-page py-20 text-center">
        <span className="mx-auto inline-flex size-16 items-center justify-center rounded-control bg-action-soft text-action">
          <ImagesIcon size={30} aria-hidden />
        </span>
        <h1 className="mt-5 display-md text-3xl">Seu carrinho está vazio</h1>
        <p className="mt-2 text-lg text-ink-2">Escolha um tamanho para começar.</p>
        <Link href="/enviar" className="btn btn-accent btn-lg mt-7">
          Escolher tamanho
        </Link>
      </div>
    );
  }

  // Miniaturas só das primeiras fotos de cada tamanho
  const groups = await Promise.all(
    products
      .filter((p) => photos.some((ph) => ph.product_id === p.id))
      .map(async (product) => {
        const own = photos.filter((ph) => ph.product_id === product.id);
        const copies = own.reduce((sum, ph) => sum + ph.quantity, 0);
        return {
          product,
          files: own.length,
          copies,
          unit: unitPrice(product, copies),
          next: nearTier(product, copies),
          lines: cart.lines.filter((l) => l.product.id === product.id),
          previews: await withThumbUrls(own.slice(0, PREVIEW_LIMIT)),
        };
      }),
  );


  return (
    <div className="container-page py-8">
      <OrderSteps current={3} />
      <h1 className="mt-3 display-md text-3xl sm:text-4xl">Seu carrinho</h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="space-y-5">
          {groups.map((group) => (
            <li key={group.product.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{group.product.name}</h2>
                  <p className="text-ink-2">
                    {plural(group.copies, "cópia", "cópias")} de {plural(group.files, "foto", "fotos")},{" "}
                    {group.unit < group.product.price_cents && (
                      <s className="text-ink-3">
                        <span className="sr-only">de </span>
                        {formatBRL(group.product.price_cents)}
                      </s>
                    )}{" "}
                    {formatBRL(group.unit)} cada
                  </p>
                </div>
                <p className="font-display text-xl font-bold text-ink">{formatBRL(group.copies * group.unit)}</p>
              </div>
              {group.next && (
                <p className="mt-2 text-sm font-semibold text-success">
                  Com mais {group.next.min - group.copies}, cada uma sai por {formatBRL(group.next.price_cents)}.
                </p>
              )}

              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={`Prévia das fotos ${group.product.name}`}>
                {group.previews.map((photo) => (
                  <li key={photo.id}>
                    <PrintPreview src={photo.thumb_url} alt={photo.file_name} photo={photo} product={group.product} resolution={320} />
                  </li>
                ))}
              </ul>
              {group.files > PREVIEW_LIMIT && (
                <p className="mt-2 text-sm text-ink-2">e mais {group.files - PREVIEW_LIMIT}.</p>
              )}

              {group.lines.length > 1 && (
                <p className="mt-3 text-sm text-ink-2">{group.lines.map((l) => `${l.quantity} ${l.finish}`).join(", ")}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-4">
                <Link href={`/enviar/${group.product.id}`} className="btn btn-outline btn-sm">
                  <PencilSimpleIcon size={16} aria-hidden />
                  Editar ou adicionar<span className="sr-only"> fotos {group.product.name}</span>
                </Link>
                <RemoveGroupButton productId={group.product.id} productName={group.product.name} />
              </div>
            </li>
          ))}
          <li>
            <Link href="/enviar" className="btn btn-ghost">
              <ImagesIcon size={18} aria-hidden />
              Adicionar outro tamanho
            </Link>
          </li>
        </ul>

        <aside className="card p-5 lg:sticky lg:top-24" aria-labelledby="resumo">
          <h2 id="resumo" className="text-xl font-bold">
            Resumo
          </h2>
          <dl className="mt-4 space-y-2">
            {cart.lines.map((line) => (
              <div key={`${line.product.id}-${line.finish}`} className="flex justify-between gap-4">
                <dt className="text-ink/85">
                  {line.quantity}× {line.description}
                </dt>
                <dd className="font-semibold tabular-nums">{formatBRL(line.total_cents)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-rule pt-3 text-lg">
              <dt className="font-bold">Subtotal</dt>
              <dd className="font-display font-bold text-ink tabular-nums">
                {formatBRL(cart.subtotal_cents)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-ink-2">Frete na próxima etapa.</p>
          <Link href="/checkout" className="btn btn-accent btn-lg mt-5 w-full">
            Finalizar pedido
          </Link>
        </aside>
      </div>
    </div>
  );
}
