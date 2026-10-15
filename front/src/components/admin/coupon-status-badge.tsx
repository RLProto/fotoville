import { COUPON_STATUS_LABEL, type CouponStatus } from "@/lib/coupon-rules";

const TONE: Record<CouponStatus, string> = {
  ativo: "bg-success-soft text-success",
  desativado: "bg-paper text-ink-2",
  expirado: "bg-warning-soft text-warning",
  esgotado: "bg-warning-soft text-warning",
};

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  return <span className={`badge ${TONE[status]}`}>{COUPON_STATUS_LABEL[status]}</span>;
}
