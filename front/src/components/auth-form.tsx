"use client";

import { CircleNotchIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RECOVERY_LINK_HOURS, SIGNUP_NEXT_KEY } from "@/lib/auth-links";
import { reportError } from "@/lib/report-error";
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

/** Erro do Supabase Auth: o código, quando vem, é mais estável que o texto. */
type AuthFailure = { code?: string; message: string };

function translate({ code, message }: AuthFailure): FormError {
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return { message: "E-mail ou senha incorretos.", fields: ["email", "senha"] };
  }
  if (code === "user_already_exists" || code === "email_exists" || /already registered/i.test(message)) {
    return { message: "Este e-mail já tem cadastro. Entre ou recupere a senha.", fields: ["email"] };
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return { message: "Confirme seu e-mail pelo link que enviamos.", fields: ["email"] };
  }
  if (code === "same_password") return { message: "Use uma senha diferente da atual.", fields: ["senha"] };
  if (code === "weak_password" || /password should be at least/i.test(message)) {
    return /at least/i.test(message)
      ? { message: "A senha precisa ter pelo menos 8 caracteres.", fields: ["senha"] }
      : { message: "Essa senha é fácil de adivinhar ou já vazou em outro site. Escolha outra.", fields: ["senha"] };
  }
  if (code === "session_not_found" || code === "session_expired" || /auth session missing/i.test(message)) {
    return { message: "Sua sessão expirou. Peça um novo link para criar a senha.", fields: [] };
  }
  // "For security purposes, you can only request this after 42 seconds."
  const wait = /after (\d+) seconds?/i.exec(message);
  if (wait) return { message: `Aguarde ${wait[1]} segundos para pedir outro link.`, fields: [] };
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(message)) {
    return { message: "Muitos e-mails enviados agora. Tente de novo em alguns minutos.", fields: [] };
  }
  if (/rate limit/i.test(message)) return { message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", fields: [] };
  if (code === "email_address_invalid" || /invalid.*email|validate email/i.test(message)) {
    return { message: "E-mail inválido. Confira o endereço.", fields: ["email"] };
  }
  return { message: "Não deu certo. Confira os dados e tente de novo.", fields: [] };
}

/** Erros que dependem da pessoa (senha errada, limite): não vão para o registro de erros. */
const EXPECTED = /invalid_credentials|user_already_exists|email_exists|email_not_confirmed|same_password|weak_password|rate_limit|email_address_invalid|validation_failed/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Espera entre dois pedidos de link para o mesmo e-mail, igual ao do Supabase com SMTP próprio. */
const RESEND_SECONDS = 60;

/**
 * Depois de entrar, recarrega a página por completo em vez de navegar pelo roteador do Next.
 * O roteador guarda em memória os redirecionamentos feitos enquanto a pessoa estava
 * deslogada (ex.: carrinho -> login) e os reaproveitaria, prendendo a pessoa na tela de login.
 */
function enter(path: string) {
  window.location.assign(path);
}

/** Erro do Supabase (AuthError tem `code`) no formato que o translate entende. */
function asFailure(err: unknown): AuthFailure {
  const code = err && typeof err === "object" && "code" in err && typeof err.code === "string" ? err.code : undefined;
  return { code, message: err instanceof Error ? err.message : "" };
}

/** Confirmação do pedido de link, com reenvio depois de uma espera e troca de e-mail. */
function RecoverySent({ email, onResend, onChangeEmail }: {
  email: string;
  onResend: () => Promise<FormError | null>;
  onChangeEmail: () => void;
}) {
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setSending(true);
    setNotice(null);
    const failure = await onResend();
    setSending(false);
    setNotice(failure ? { ok: false, message: failure.message } : { ok: true, message: "Enviamos outro link." });
    setWait(RESEND_SECONDS);
  }

  return (
    <div className="space-y-4">
      <div className="alert alert-success" role="status">
        <p>
          Se houver conta para <strong className="break-all">{email}</strong>, enviamos um link. Ele vale por{" "}
          {RECOVERY_LINK_HOURS === 1 ? "1 hora" : `${RECOVERY_LINK_HOURS} horas`}.
        </p>
      </div>
      <p className="text-sm text-ink-2">Não chegou? Confira a caixa de spam.</p>
      {notice && (
        <p className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`} role={notice.ok ? "status" : "alert"}>
          {notice.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-outline" onClick={resend} disabled={sending || wait > 0}>
          {sending && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
          {sending ? "Enviando…" : wait > 0 ? `Reenviar em ${wait} s` : "Reenviar link"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onChangeEmail}>
          Usar outro e-mail
        </button>
      </div>
    </div>
  );
}

export function AuthForm({ mode, next = "/conta", account }: { mode: Mode; next?: string; account?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

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

  const callback = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  /** Pede o link de nova senha. Devolve o erro já traduzido, ou null se o Supabase aceitou. */
  async function requestRecovery(address: string): Promise<FormError | null> {
    const { error } = await createClient().auth.resetPasswordForEmail(address, { redirectTo: callback("/nova-senha") });
    if (!error) return null;
    const failure = asFailure(error);
    if (!EXPECTED.test(failure.code ?? "") && !/after \d+ seconds?|rate limit/i.test(failure.message)) {
      reportError("conta", error, { etapa: "pedir link de nova senha", code: failure.code }, "warning");
    }
    return translate(failure);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const address = email.trim();

    if (needsEmail && !EMAIL_RE.test(address)) {
      return fail({ message: "E-mail inválido. Confira o endereço.", fields: ["email"] });
    }
    if (needsPassword && password.length < 8) {
      return fail({ message: "A senha precisa ter pelo menos 8 caracteres.", fields: ["senha"] });
    }
    if (mode === "cadastro") {
      if (name.trim().length < 3) return fail({ message: "Informe seu nome completo.", fields: ["nome"] });
      if (!accepted) return fail({ message: "Aceite os termos de uso para criar a conta.", fields: ["termos"] });
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        enter(next);
        return;
      }
      if (mode === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: {
            // O destino fica na conta: o link do e-mail de confirmação volta para cá em qualquer aparelho
            data: { full_name: name.trim(), [SIGNUP_NEXT_KEY]: next },
            emailRedirectTo: callback(next),
          },
        });
        if (error) throw error;
        if (data.session) {
          enter(next);
          return;
        }
        setDone(`Enviamos um link para ${address}. Abra o e-mail para ativar a conta.`);
      }
      if (mode === "recuperar") {
        const failure = await requestRecovery(address);
        if (failure) {
          fail(failure);
        } else {
          setSentTo(address);
        }
      }
      if (mode === "nova-senha") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // Quem pediu nova senha pode ter perdido o controle da conta: as outras sessões saem
        await supabase.auth.signOut({ scope: "others" }).catch(() => {});
        enter("/conta?senha=alterada");
        return;
      }
    } catch (err) {
      const failure = asFailure(err);
      if (mode === "nova-senha" && /session_not_found|session_expired/.test(failure.code ?? "")) {
        enter("/recuperar-senha?erro=link");
        return;
      }
      if (mode === "nova-senha" && !EXPECTED.test(failure.code ?? "")) {
        reportError("conta", err, { etapa: "salvar nova senha", code: failure.code }, "warning");
      }
      fail(translate(failure));
    }
    setLoading(false);
  }

  if (sentTo) {
    return (
      <RecoverySent
        email={sentTo}
        onResend={() => requestRecovery(sentTo)}
        onChangeEmail={() => {
          setSentTo(null);
          setError(null);
        }}
      />
    );
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

      {mode === "nova-senha" && account && (
        // Para o gerenciador de senhas salvar a nova senha na conta certa
        <input type="email" name="username" autoComplete="username" value={account} readOnly hidden />
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
