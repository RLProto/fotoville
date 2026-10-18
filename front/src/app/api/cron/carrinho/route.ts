import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { cartCleanupEnabled, cartDeleteAfter, formatCartDay, noticeIdleSince } from "@/lib/cart-retention";
import { logError } from "@/lib/error-log";
import { deleteObjects, hasStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/server";
import { CART_TEMPLATE, hasWhatsApp, sendTemplate, toWaNumber } from "@/lib/whatsapp";

export const maxDuration = 300;

type StaleCart = {
  user_id: string;
  last_activity: string;
  files: number;
  whatsapp: string | null;
  whatsapp_avisos: boolean;
  notice_id: number | null;
  delete_after: string | null;
  deleted_at: string | null;
};

/**
 * Job diário do Vercel (vercel.json > crons). Avisa pelo WhatsApp quem tem fotos paradas no carrinho
 * perto do prazo e apaga, do bucket e do banco, os carrinhos cujo aviso já venceu.
 * O Vercel manda `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET não configurado.", 503);
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return fail("Acesso restrito.", 401);
  if (!cartCleanupEnabled) return NextResponse.json({ skipped: "CARRINHO_LIMPEZA desligado" });
  if (!hasStorage) return fail("Armazenamento não configurado.", 503);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("stale_carts", { idle_since: noticeIdleSince() });
  if (error) {
    await logError({ source: "server", scope: "carrinho", message: error.message, detail: { etapa: "stale_carts" } });
    return fail(error.message, 500);
  }

  const now = Date.now();
  const result = { avisos: 0, enviados: 0, apagados: 0, fotos: 0, falhas: 0 };

  for (const cart of (data ?? []) as StaleCart[]) {
    try {
      if (cart.notice_id === null) {
        await notify(admin, cart, now, result);
      } else if (!cart.deleted_at && cart.delete_after && new Date(cart.delete_after).getTime() < now) {
        await purge(admin, cart, result);
      }
    } catch (err) {
      result.falhas++;
      await logError({
        source: "server",
        scope: "carrinho",
        message: err instanceof Error ? err.message : String(err),
        detail: { usuario: cart.user_id, ultima_foto: cart.last_activity },
        userId: cart.user_id,
      });
    }
  }
  return NextResponse.json(result);
}

type Admin = ReturnType<typeof createAdminClient>;

async function notify(admin: Admin, cart: StaleCart, now: number, result: Record<string, number>) {
  const deleteAfter = cartDeleteAfter(cart.last_activity, now);
  const to = toWaNumber(cart.whatsapp);
  let status = !to ? "sem_whatsapp" : !cart.whatsapp_avisos ? "sem_avisos" : !hasWhatsApp ? "sem_config" : "enviado";
  let messageId: string | null = null;
  let sendError: string | null = null;

  if (status === "enviado" && to) {
    try {
      messageId = await sendTemplate(to, CART_TEMPLATE, [formatCartDay(deleteAfter)]);
      result.enviados++;
    } catch (err) {
      status = "falhou";
      sendError = err instanceof Error ? err.message : String(err);
      await logError({
        source: "server",
        scope: "whatsapp",
        level: "warning",
        message: sendError,
        detail: { etapa: "aviso do carrinho" },
        userId: cart.user_id,
      });
    }
  }

  const { error } = await admin.from("cart_notices").insert({
    user_id: cart.user_id,
    last_activity: cart.last_activity,
    delete_after: deleteAfter,
    status,
    message_id: messageId,
    error: sendError,
  });
  if (error) throw new Error(error.message);
  result.avisos++;
}

async function purge(admin: Admin, cart: StaleCart, result: Record<string, number>) {
  // Primeiro as linhas, e só as que continuam no carrinho e que o aviso cobria: se o cliente fechou
  // o pedido agora, a foto já tem order_id e o arquivo fica. Foto nova mudaria a última atividade.
  const { data: photos, error } = await admin
    .from("photos")
    .delete()
    .eq("user_id", cart.user_id)
    .is("order_id", null)
    .lte("created_at", cart.last_activity)
    .select("storage_key, thumb_key");
  if (error) throw new Error(error.message);
  if (!photos?.length) return;

  await deleteObjects(photos.flatMap((p) => [p.storage_key, p.thumb_key]));

  await admin
    .from("cart_notices")
    .update({ deleted_at: new Date().toISOString(), deleted_photos: photos.length })
    .eq("id", cart.notice_id!);
  result.apagados++;
  result.fotos += photos.length;
}
