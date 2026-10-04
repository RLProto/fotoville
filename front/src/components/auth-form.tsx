"use client";

import { CircleNotchIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "entrar" | "cadastro" | "recuperar" | "nova-senha";

const COPY: Record<Mode, { submit: string; loading: string }> = {
  entrar: { submit: "Entrar", loading: "Entrando…" },
  cadastro: { submit: "Criar conta", loading: "Criando conta…" },
  recuperar: { submit: "Enviar link", loading: "Enviando…" },
  "nova-senha": { submit: "Salvar nova senha", loading: "Salvando…" },
};

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(message)) return "Este e-mail já tem cadastro. Entre ou recupere a senha.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail pelo link que enviamos.";
  if (/password should be at least/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/rate limit/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/invalid.*email|validate email/i.test(message)) return "E-mail inválido. Confira o endereço.";
  return "Não deu certo. Confira os dados e tente de novo.";
}

/**
 * Depois de entrar, recarrega a página por completo em vez de navegar pelo roteador do Next.
 * O roteador guarda em memória os redirecionamentos feitos enquanto a pessoa estava
 * deslogada (ex.: carrinho -> login) e os reaproveitaria, prendendo a pessoa na tela de login.
 */
function enter(path: string) {
  window.location.assign(path);
}

export function AuthForm({ mode, next = "/conta" }: { mode: Mode; next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const needsEmail = mode !== "nova-senha";
  const needsPassword = mode !== "recuperar";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (needsPassword && password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (mode === "cadastro") {
      if (name.trim().length < 3) return setError("Informe seu nome completo.");
      if (!accepted) return setError("Aceite os termos de uso para criar a conta.");
    }

    setLoading(true);
    const supabase = createClient();
    const callback = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        enter(next);
        return;
      }
      if (mode === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: callback(next),
          },
        });
        if (error) throw error;
        if (data.session) {
          enter(next);
          return;
        }
        setDone(`Enviamos um link para ${email}. Abra o e-mail para ativar a conta.`);
      }
      if (mode === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/nova-senha") });
        if (error) throw error;
        setDone(`Se houver conta para ${email}, você vai receber um link.`);
      }
      if (mode === "nova-senha") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        enter("/conta");
        return;
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : ""));
    }
    setLoading(false);
  }

  if (done) {
    return (
      <p className="alert alert-success" role="status">
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {mode === "cadastro" && (
        <>
          <div>
            <label htmlFor="nome" className="field-label">
              Nome completo
            </label>
            <input
              id="nome"
              className="field-input"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </>
      )}

      {needsEmail && (
        <div>
          <label htmlFor="email" className="field-label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            name="email"
            spellCheck={false}
            autoCapitalize="none"
            className="field-input"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}

      {needsPassword && (
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="senha" className="field-label">
              {mode === "nova-senha" ? "Nova senha" : "Senha"}
            </label>
            {mode === "entrar" && (
              <Link href="/recuperar-senha" className="text-sm font-semibold text-action underline underline-offset-2">
                Esqueci a senha
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="senha"
              type={show ? "text" : "password"}
              className="field-input pr-12"
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              aria-describedby={mode === "entrar" ? undefined : "senha-dica"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={show}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-ink-2 hover:text-ink"
            >
              {show ? <EyeSlashIcon size={20} aria-hidden /> : <EyeIcon size={20} aria-hidden />}
            </button>
          </div>
          {mode !== "entrar" && (
            <p id="senha-dica" className="field-hint">
              Pelo menos 8 caracteres.
            </p>
          )}
        </div>
      )}

      {mode === "cadastro" && (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-action"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos-de-uso" target="_blank" className="font-semibold text-action underline">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/politica-de-privacidade" target="_blank" className="font-semibold text-action underline">
              política de privacidade
            </Link>
            .
          </span>
        </label>
      )}

      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-accent w-full" disabled={loading}>
        {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
        {loading ? COPY[mode].loading : COPY[mode].submit}
      </button>
    </form>
  );
}
