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

/** Campos do formulário; o id do input é o próprio nome. */
type Field = "nome" | "email" | "senha" | "termos";
/** Aviso de erro e os campos a que ele se refere (o leitor de tela lê o aviso junto do campo). */
type FormError = { message: string; fields: Field[] };

function translate(message: string): FormError {
  if (/invalid login credentials/i.test(message)) return { message: "E-mail ou senha incorretos.", fields: ["email", "senha"] };
  if (/already registered/i.test(message)) {
    return { message: "Este e-mail já tem cadastro. Entre ou recupere a senha.", fields: ["email"] };
  }
  if (/email not confirmed/i.test(message)) return { message: "Confirme seu e-mail pelo link que enviamos.", fields: ["email"] };
  if (/password should be at least/i.test(message)) {
    return { message: "A senha precisa ter pelo menos 8 caracteres.", fields: ["senha"] };
  }
  if (/rate limit/i.test(message)) return { message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", fields: [] };
  if (/invalid.*email|validate email/i.test(message)) return { message: "E-mail inválido. Confira o endereço.", fields: ["email"] };
  return { message: "Não deu certo. Confira os dados e tente de novo.", fields: [] };
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
  const [error, setError] = useState<FormError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const needsEmail = mode !== "nova-senha";
  const needsPassword = mode !== "recuperar";

  /** Mostra o erro e leva o foco ao primeiro campo com problema, como no checkout. */
  function fail(found: FormError) {
    setError(found);
    if (found.fields[0]) document.getElementById(found.fields[0])?.focus();
  }
  const invalid = (field: Field) => Boolean(error?.fields.includes(field));
  /** aria-describedby do campo: a dica dele, se houver, e o aviso de erro quando é sobre ele. */
  const describedBy = (field: Field, hint?: string) =>
    [hint, invalid(field) ? "auth-erro" : undefined].filter(Boolean).join(" ") || undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (needsPassword && password.length < 8) {
      return fail({ message: "A senha precisa ter pelo menos 8 caracteres.", fields: ["senha"] });
    }
    if (mode === "cadastro") {
      if (name.trim().length < 3) return fail({ message: "Informe seu nome completo.", fields: ["nome"] });
      if (!accepted) return fail({ message: "Aceite os termos de uso para criar a conta.", fields: ["termos"] });
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
      fail(translate(err instanceof Error ? err.message : ""));
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
              aria-invalid={invalid("nome")}
              aria-describedby={describedBy("nome")}
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
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
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
              <Link
                href="/recuperar-senha"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-2 sm:min-h-6"
              >
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
              aria-invalid={invalid("senha")}
              aria-describedby={describedBy("senha", mode === "entrar" ? undefined : "senha-dica")}
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
            id="termos"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-invalid={invalid("termos")}
            aria-describedby={describedBy("termos")}
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
        <p id="auth-erro" className="alert alert-danger" role="alert">
          {error.message}
        </p>
      )}

      <button type="submit" className="btn btn-accent w-full" disabled={loading}>
        {loading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
        {loading ? COPY[mode].loading : COPY[mode].submit}
      </button>
    </form>
  );
}
