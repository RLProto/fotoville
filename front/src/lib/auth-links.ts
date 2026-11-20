import { safeNext } from "./safe-next";

/**
 * Links de e-mail da conta. Os modelos do Supabase (Authentication > Emails) apontam para
 * /auth/confirmar com token_hash e type; o passo a passo está no README.
 */
export const CONFIRM_TYPES = ["recovery", "email", "signup"] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export const isConfirmType = (value: unknown): value is ConfirmType =>
  typeof value === "string" && (CONFIRM_TYPES as readonly string[]).includes(value);

/** Chave, em user_metadata, do destino escolhido no cadastro (o modelo do e-mail não carrega o destino). */
export const SIGNUP_NEXT_KEY = "signup_next";

/**
 * Para onde vai quem confirmou o link: recuperação sempre cria a nova senha; confirmação de cadastro volta
 * para onde a pessoa estava quando criou a conta (envio de fotos, carrinho), ou para a conta.
 */
export function confirmDestination(type: ConfirmType, next: string, metadata?: Record<string, unknown>) {
  if (type === "recovery") return "/nova-senha";
  const saved = typeof metadata?.[SIGNUP_NEXT_KEY] === "string" ? (metadata[SIGNUP_NEXT_KEY] as string) : undefined;
  return safeNext(next || saved);
}

/** Validade do link de recuperação, igual a "Email OTP expiration" no Supabase (3600 s). */
export const RECOVERY_LINK_HOURS = 1;
