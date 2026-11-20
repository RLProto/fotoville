"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { confirmDestination, isConfirmType } from "@/lib/auth-links";
import { logError } from "@/lib/error-log";
import { createClient } from "@/lib/supabase/server";

export type ConfirmState = { failed: boolean };

/**
 * Confere o link do e-mail (token_hash) e abre a sessão. Roda só no clique do botão, nunca ao abrir a página:
 * antivírus e leitores de e-mail que visitam o link antes do cliente não gastam o token.
 */
export async function confirmLink(_prev: ConfirmState, form: FormData): Promise<ConfirmState> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = form.get("type");
  if (!tokenHash || !isConfirmType(type)) return { failed: true };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  if (error || !data.user) {
    await logError({
      source: "server",
      scope: "conta",
      level: "warning",
      message: `Link do e-mail recusado (${type}): ${error?.code ?? ""} ${error?.message ?? "sem usuário"}`.trim(),
      detail: { tipo: type },
    });
    return { failed: true };
  }
  redirect(confirmDestination(type, String(form.get("next") ?? ""), data.user.user_metadata));
}
