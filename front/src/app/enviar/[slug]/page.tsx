import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSteps } from "@/components/order-steps";
import { Uploader } from "@/components/uploader";
import { getProduct } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { hasSupabase } from "@/lib/site";
import { hasStorage, withThumbUrls } from "@/lib/storage";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Photo, PhotoView } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product ? `Enviar fotos ${product.name}` : "Enviar fotos" };
}

export default async function EnviarPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  let photos: PhotoView[] = [];
  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .is("order_id", null)
      .order("created_at");
    photos = await withThumbUrls((data ?? []) as Photo[]);
  }

  return (
    <div className="container-page py-8">
      <Link
        href="/enviar"
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-action hover:underline"
      >
        <CaretLeftIcon size={18} aria-hidden />
        Todos os tamanhos
      </Link>

      <OrderSteps current={2} className="mt-2" />

      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-md text-3xl sm:text-4xl">Fotos {product.name}</h1>
          <p className="mt-1 text-lg text-ink-2">
            {formatBRL(product.price_cents)} por foto
          </p>
          {product.price_tiers.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-2 tabular-nums" aria-label="Desconto por quantidade">
              {product.price_tiers.map((tier) => (
                <li key={tier.min}>
                  {tier.min}+ fotos: {formatBRL(tier.price_cents)} cada
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!hasSupabase ? (
        <p className="alert alert-warning">
          O banco de dados ainda não foi configurado neste ambiente. Preencha o arquivo .env.local para liberar o
          envio de fotos.
        </p>
      ) : (
        <Uploader product={product} initialPhotos={photos} storageReady={hasStorage} />
      )}
    </div>
  );
}
