import type { Coupon } from "./types";

/** Código de cupom criado no painel: letras maiúsculas e números, de 3 a 20. O banco confere a mesma regra. */
export const COUPON_CODE = /^[A-Z0-9]{3,20}$/;
export const COUPON_CODE_MAX = 20;

/** Deixa o que foi digitado no formato do código: maiúsculas, sem espaço, acento ou símbolo. */
export function cleanCouponCode(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // acentos soltos pelo NFD
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, COUPON_CODE_MAX);
}

/** Desconto do cupom percentual sobre o pedido inteiro (fotos e frete), arredondado para baixo. */
export const percentDiscount = (orderCents: number, percent: number) => Math.floor((orderCents * percent) / 100);

/** Validade escolhida no painel (dia) vira o fim desse dia em Brasília. */
export const endOfDayBrasilia = (day: string) => `${day}T23:59:59.999-03:00`;

export type CouponStatus = "ativo" | "desativado" | "expirado" | "esgotado";

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  ativo: "Ativo",
  desativado: "Desativado",
  expirado: "Expirado",
  esgotado: "Esgotado",
};

/** Regra de uso, para o painel. O limite total aparece junto da contagem ("3 de 10"). */
export function couponLimitLabel(coupon: Pick<Coupon, "max_uses" | "once_per_customer">) {
  if (coupon.max_uses === 1) return "Uso único";
  if (coupon.once_per_customer) return "Uma vez por cliente";
  return coupon.max_uses === null ? "Sem limite" : "";
}

/** Situação do cupom para o painel. `uses`: pedidos não cancelados com o cupom. */
export function couponStatus(coupon: Pick<Coupon, "active" | "expires_at" | "max_uses">, uses: number): CouponStatus {
  if (!coupon.active) return "desativado";
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return "expirado";
  if (coupon.max_uses !== null && uses >= coupon.max_uses) return "esgotado";
  return "ativo";
}
