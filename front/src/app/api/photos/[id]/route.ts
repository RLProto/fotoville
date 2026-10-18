import { NextResponse } from "next/server";
import { z } from "zod";
import { isNeutralAdjust, normalizeAdjust } from "@/lib/adjust";
import { fail, reportServerError, requireUser, serverFail } from "@/lib/api";
import { getProduct } from "@/lib/catalog";
import { adjustSchema, quantitySchema } from "@/lib/photo-schemas";
import { deleteObjects, hasStorage, presignDownload } from "@/lib/storage";
import type { Photo } from "@/lib/types";

const patchSchema = z
  .object({
    crop: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    fit: z.boolean(),
    adjust: adjustSchema.nullable(),
    finish: z.enum(["brilho", "fosco"]),
    quantity: quantitySchema,
  })
  .partial();

type Ctx = { params: Promise<{ id: string }> };

/** URL temporária do arquivo original, para o editor de corte. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasStorage) return fail("Armazenamento de fotos não configurado.", 503);

  const { id } = await params;
  const { data } = await auth.supabase.from("photos").select("storage_key").eq("id", id).maybeSingle();
  if (!data) return fail("Foto não encontrada.", 404);
  return NextResponse.json({ url: await presignDownload(data.storage_key, { expiresIn: 600 }) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return fail("Não foi possível salvar. Tente de novo.");
  const patch = parsed.data;

  const { data: current } = await auth.supabase
    .from("photos")
    .select("*")
    .eq("id", id)
    .is("order_id", null)
    .maybeSingle();
  if (!current) return fail("Esta foto não está mais no carrinho. Atualize a página.", 404);
  const photo = current as Photo;

  if (patch.crop) {
    const c = patch.crop;
    if (c.x + c.width > photo.width_px + 1 || c.y + c.height > photo.height_px + 1) {
      return fail("Não foi possível salvar o corte. Ajuste de novo.");
    }
  }
  if (patch.finish || patch.adjust) {
    const product = await getProduct(photo.product_id);
    if (patch.finish && product && !product.finishes.includes(patch.finish)) {
      return fail("Acabamento indisponível neste tamanho.");
    }
    // Borda só fora da Polaroid, legenda só nela; sem nenhum ajuste, grava null.
    if (patch.adjust && product) {
      const adjust = normalizeAdjust(patch.adjust, product);
      patch.adjust = isNeutralAdjust(adjust) ? null : adjust;
    }
  }

  const { data, error } = await auth.supabase
    .from("photos")
    .update(patch)
    .eq("id", id)
    .is("order_id", null)
    .select("*")
    .single();
  if (error) return serverFail("fotos", "Não foi possível salvar. Tente de novo.", error, 500, { etapa: "salvar ajustes", photo: id });
  return NextResponse.json({ photo: data });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from("photos")
    .delete()
    .eq("id", id)
    .is("order_id", null)
    .select("storage_key, thumb_key")
    .maybeSingle();
  if (error) return serverFail("fotos", "Não foi possível remover a foto. Tente de novo.", error, 500, { etapa: "remover foto", photo: id });
  if (!data) return fail("Esta foto não está mais no carrinho. Atualize a página.", 404);

  if (hasStorage) {
    await deleteObjects([data.storage_key, data.thumb_key]).catch((err) =>
      reportServerError("fotos", err, { etapa: "apagar do armazenamento", photo: id }, "warning"),
    );
  }
  return NextResponse.json({ ok: true });
}
