"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState } from "react";
import { confirmLink, type ConfirmState } from "@/app/auth/confirmar/actions";
import type { ConfirmType } from "@/lib/auth-links";

/** Link vencido, já usado ou cortado: oferece o caminho certo para cada tipo. */
export function InvalidLink({ recovery }: { recovery: boolean }) {
  return (
    <div className="space-y-4">
      <p className="alert alert-danger" role="alert">
        Este link expirou ou já foi usado.
      </p>
      {recovery ? (
        <Link href="/recuperar-senha" className="btn btn-accent w-full">
          Pedir outro link
        </Link>
      ) : (
        <Link href="/entrar" className="btn btn-accent w-full">
          Entrar
        </Link>
      )}
    </div>
  );
}

export function ConfirmLinkForm({ tokenHash, type, next }: { tokenHash: string; type: ConfirmType; next: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmLink, { failed: false });
  if (state.failed) return <InvalidLink recovery={type === "recovery"} />;

  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="btn btn-accent w-full" disabled={pending}>
        {pending && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
        {pending ? "Abrindo…" : type === "recovery" ? "Continuar" : "Confirmar"}
      </button>
    </form>
  );
}
