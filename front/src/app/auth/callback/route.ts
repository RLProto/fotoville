import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = ["email", "signup", "recovery", "invite", "magiclink", "email_change"] as const;

/**
 * Destino dos links de confirmação de e-mail e de recuperação de senha. Aceita dois formatos:
 * - `token_hash` e `type`: link dos modelos de e-mail do projeto, conferido aqui no servidor.
 *   Funciona em qualquer aparelho (o cliente se cadastra no computador e abre o e-mail no celular).
 * - `code`: link padrão do Supabase. Só funciona no mesmo navegador que pediu (PKCE).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next") ?? undefined);

  const supabase = await createClient();
  if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
