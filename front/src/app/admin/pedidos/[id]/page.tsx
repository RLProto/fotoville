import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderControls } from "@/components/admin/order-controls";
import { PhotoDownloads, type AdminPhoto } from "@/components/admin/photo-downloads";
import { StatusBadge } from "@/components/order-status";
import { PRODUCTS } from "@/lib/catalog-data";
import { formatBRL, formatCep, formatCpf, formatDate, formatPhone } from "@/lib/format";
import { hasStorage, presignDownload } from "@/lib/storage";
import { createAdminClient, getProfile } from "@/lib/supabase/server";
import type { Order, OrderItem, Photo, Product } from "@/lib/types";

export default async function AdminPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getProfile())?.is_admin) notFound();

  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: orderData }, { data: items }, { data: photoData }, { data: productData }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).maybeSingle(),
    admin.from("order_items").select("*").eq("order_id", id),
    admin.from("photos").select("*").eq("order_id", id).order("product_id").order("created_at"),
    admin.from("products").select("*"), // inclui produtos desativados de pedidos antigos
  ]);
  if (!orderData) notFound();

  const order = orderData as Order;
  const products = (productData?.length
    ? productData.map((p) => ({ ...p, width_cm: Number(p.width_cm), height_cm: Number(p.height_cm) }))
    : PRODUCTS) as Product[];

  const photos: AdminPhoto[] = await Promise.all(
    ((photoData ?? []) as Photo[]).map(async (photo, i) => {
      const ext = photo.storage_key.split(".").pop() ?? "jpg";
      const base_name = `${order.number}_${photo.product_id}_${photo.finish}_${photo.quantity}x_${String(i + 1).padStart(3, "0")}`;
      return {
        ...photo,
        base_name,
        thumb_url: hasStorage ? await presignDownload(photo.thumb_key ?? photo.storage_key) : null,
        original_url: hasStorage
          ? await presignDownload(photo.storage_key, { downloadName: `${base_name}_original.${ext}` })
          : "#",
      };
    }),
  );

  const address = order.shipping_address;
  const customer = order.customer;

  return (
    <>
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-1 font-semibold text-action hover:underline">
        <CaretLeftIcon size={18} aria-hidden />
        Todos os pedidos
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-md text-3xl">Pedido #{order.number}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-ink-2">
        {formatDate(order.created_at)}
        {order.paid_at && `, pago em ${formatDate(order.paid_at)}${order.payment_method ? ` (${order.payment_method})` : ""}`}
      </p>

      <section className="card mt-6 p-5" aria-label="Atualizar pedido">
        <OrderControls orderId={order.id} status={order.status} trackingCode={order.tracking_code} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="cliente">
          <h2 id="cliente" className="text-lg font-bold">
            Cliente
          </h2>
          <dl className="mt-3 space-y-1">
            <div>
              <dt className="sr-only">Nome</dt>
              <dd className="font-semibold">{customer?.name ?? "Sem nome"}</dd>
            </div>
            <div>
              <dt className="sr-only">E-mail</dt>
              <dd className="break-all">{customer?.email}</dd>
            </div>
            {order.price_profile_name && (
              <div>
                <dt className="sr-only">Tabela de preço</dt>
                <dd>
                  <span className="badge bg-action-soft text-action-strong">Tabela: {order.price_profile_name}</span>
                </dd>
              </div>
            )}
            {customer?.whatsapp && (
              <div>
                <dt className="sr-only">WhatsApp</dt>
                <dd>
                  <a
                    href={`https://wa.me/55${customer.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-action underline underline-offset-2"
                  >
                    {formatPhone(customer.whatsapp)}
                  </a>
                </dd>
              </div>
            )}
            {customer?.cpf && (
              <div>
                <dt className="inline">CPF: </dt>
                <dd className="inline">{formatCpf(customer.cpf)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card p-5" aria-labelledby="entrega">
          <h2 id="entrega" className="text-lg font-bold">
            Entrega
          </h2>
          <p className="mt-3 font-semibold">
            {order.shipping_label ?? "Sem entrega"}
            {order.shipping_estimated && <span className="badge ml-2 bg-warning-soft text-warning">frete estimado</span>}
          </p>
          {address && (
            <address className="mt-1 not-italic">
              {address.street}, {address.number}
              {address.complement ? ` - ${address.complement}` : ""}
              <br />
              {address.district}, {address.city}/{address.state}
              <br />
              CEP {formatCep(address.cep)}
            </address>
          )}
          {order.parcel && (
            <p className="mt-3 text-sm text-ink-2">
              Pacote estimado: {order.parcel.weight_g} g, {order.parcel.length_cm}×{order.parcel.width_cm}×
              {order.parcel.height_cm} cm
            </p>
          )}
        </section>

        <section className="card p-5" aria-labelledby="valores">
          <h2 id="valores" className="text-lg font-bold">
            Valores
          </h2>
          <dl className="mt-3 space-y-1">
            {((items ?? []) as OrderItem[]).map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <dt>
                  {item.quantity}× {item.description}
                </dt>
                <dd className="tabular-nums">{formatBRL(item.total_cents)}</dd>
              </div>
            ))}
            {order.discount_cents > 0 && (
              <div className="flex justify-between gap-3">
                <dt>Cupom {order.coupon_code}</dt>
                <dd className="tabular-nums">− {formatBRL(order.discount_cents)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt>Frete</dt>
              <dd className="tabular-nums">{formatBRL(order.shipping_cents)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-rule pt-2 font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(order.total_cents)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {order.kind === "prints" && (
        <section className="mt-8" aria-labelledby="fotos">
          <h2 id="fotos" className="mb-4 text-2xl font-bold">
            Fotos para imprimir
          </h2>
          {!hasStorage && (
            <p className="alert alert-warning mb-4">Armazenamento não configurado: os downloads estão indisponíveis.</p>
          )}
          <PhotoDownloads photos={photos} products={products} />
        </section>
      )}
    </>
  );
}
