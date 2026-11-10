/**
 * Descrição do pedido: um nome curto que o cliente (ou a loja) dá ao pedido, como "Casamento Ana".
 * Sai na etiqueta do envelope, entre parênteses depois do nome do cliente.
 */
import type { Order } from "./types";

export const NOTE_MAX = 30;

/** Letras de qualquer língua, números, espaço e pontuação simples. Parênteses ficam de fora: a etiqueta já põe. */
const ALLOWED = /^[\p{L}\p{M}\p{N} .,'&/-]*$/u;

/** Espaços juntados e pontas aparadas; vazio vira null (sem descrição). */
export function normalizeNote(value: string) {
  const text = value.normalize("NFC").replace(/\s+/g, " ").trim();
  return text || null;
}

/** Caracteres como o banco conta (char_length): emoji e símbolos já são recusados antes. */
export function noteLength(value: string) {
  return Array.from(value.normalize("NFC")).length;
}

/** Motivo para recusar a descrição, ou null se está boa. */
export function noteProblem(value: string | null) {
  if (!value) return null;
  if (noteLength(value) > NOTE_MAX) return `Use até ${NOTE_MAX} caracteres.`;
  if (!ALLOWED.test(value)) return "Use só letras, números e . , - / & '";
  return null;
}

/** O cliente pode mudar a descrição até a etiqueta ser impressa. A loja muda quando quiser. */
export function customerCanEditNote(order: Pick<Order, "kind" | "status" | "label_printed_at">) {
  return (
    order.kind === "prints" &&
    !order.label_printed_at &&
    (order.status === "pending" || order.status === "paid" || order.status === "in_production")
  );
}
