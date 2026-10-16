import { endOfDayBrasilia } from "./coupon-rules";

/** Dias que as fotos ficam no carrinho, contados da mais recente. Decisão da loja. */
export const CART_RETENTION_DAYS = 30;
/** Antecedência do aviso pelo WhatsApp. O carrinho nunca é apagado antes disso, contando do aviso. */
export const CART_NOTICE_DAYS = 3;

const DAY = 24 * 60 * 60 * 1000;

/** Limpeza ligada no ambiente (CARRINHO_LIMPEZA=1). Desligada, o carrinho não expira. */
export const cartCleanupEnabled = process.env.CARRINHO_LIMPEZA === "1";

const dayBrasilia = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));

/**
 * Último instante em que as fotos ficam salvas: fim do dia, em Brasília, do prazo contado da foto
 * mais recente, ou de `CART_NOTICE_DAYS` depois do aviso, o que vier por último.
 */
export function cartDeleteAfter(lastActivity: string, noticeAt?: number) {
  const byActivity = new Date(lastActivity).getTime() + CART_RETENTION_DAYS * DAY;
  const ms = noticeAt === undefined ? byActivity : Math.max(byActivity, noticeAt + CART_NOTICE_DAYS * DAY);
  return endOfDayBrasilia(dayBrasilia(ms));
}

/** Carrinhos parados há tanto tempo que já entram na fila do aviso. */
export const noticeIdleSince = () => new Date(Date.now() - (CART_RETENTION_DAYS - CART_NOTICE_DAYS) * DAY).toISOString();

/** "20 de novembro", para o aviso e o carrinho. */
export const formatCartDay = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
