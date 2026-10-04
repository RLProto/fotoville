import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, reportServerError, requireUser, serverFail } from "@/lib/api";
import { getProduct } from "@/lib/catalog";
import { defaultCrop } from "@/lib/crop";
import { deleteObjects, hasStorage, withThumbUrls } from "@/lib/storage";
import type { Photo } from "@/lib/types";

const createSchema = z.object({
  product_id: z.string(),
  storage_key: z.string(),
  thumb_key: z.string().nullable(),
  file_name: z.string().max(255),
  width_px: z.number().int().positive().max(100_000),
  height_px: z.number().int().positive().max(100_000),
  finish: z.enum(["brilho", "fosco"]).optional(),
});

/** Registra uma foto já enviada ao bucket como item do carrinho. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Dados da foto inválidos.");
  const input = parsed.data;

  const prefix = `u/${auth.user.id}/`;
  if (!input.storage_key.startsWith(prefix) || (input.thumb_key && !input.thumb_key.startsWith(prefix))) {
    return fail("Arquivo não pertence a este usuário.", 403);
  }

  const product = await getProduct(input.product_id);
  if (!product) return fail("Tamanho não encontrado.", 404);

  const finish = input.finish && product.finishes.includes(input.finish) ? input.finish : product.finishes[0];

  const { data, error } = await auth.supabase
    .from("photos")
    .insert({
      user_id: auth.user.id,
      product_id: product.id,
      storage_key: input.storage_key,
      thumb_key: input.thumb_key,
      file_name: input.file_name,
      width_px: input.width_px,
      height_px: input.height_px,
      crop: defaultCrop(input.width_px, input.height_px, product),
      finish,
      quantity: 1,
    })
    .select("*")
    .single();
  if (error) return serverFail("fotos", error.message, error, 500, { etapa: "registrar foto", product: product.id });

  const [photo] = await withThumbUrls([data as Photo]);
  return NextResponse.json({ photo });
}

/** Remove do carrinho todas as fotos de um tamanho (?product=10x15) ou o carrinho inteiro. */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const productId = new URL(request.url).searchParams.get("product");
  let query = auth.supabase.from("photos").delete().eq("user_id", auth.user.id).is("order_id", null);
  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query.select("storage_key, thumb_key");
  if (error) return serverFail("fotos", error.message, error, 500, { etapa: "remover fotos", product: productId });

  if (hasStorage && data?.length) {
    await deleteObjects(data.flatMap((p) => [p.storage_key, p.thumb_key])).catch((err) =>
      reportServerError("fotos", err, { etapa: "apagar do armazenamento", count: data.length }, "warning"),
    );
  }
  return NextResponse.json({ removed: data?.length ?? 0 });
}
