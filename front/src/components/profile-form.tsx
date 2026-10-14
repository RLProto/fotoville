"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPhone, onlyDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

/**
 * Nome e WhatsApp da conta. Aparecem como texto; os campos só abrem em "Editar", porque mudam
 * raramente e o formulário aberto convidava a mexer sem querer.
 */
export function ProfileForm({ userId, initial }: { userId: string; initial: { name: string; whatsapp: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [whatsapp, setWhatsapp] = useState(formatPhone(initial.whatsapp));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: name.trim(), whatsapp: onlyDigits(whatsapp) })
      .eq("id", userId);
    setState(error ? "error" : "saved");
    if (!error) {
      setEditing(false);
      router.refresh();
    }
  }

  function cancel() {
    setName(initial.name);
    setWhatsapp(formatPhone(initial.whatsapp));
    setState("idle");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <p className="font-semibold">{name.trim() || <span className="font-normal text-ink-2">Sem nome</span>}</p>
        <p className="text-ink-2">{whatsapp || "Sem WhatsApp"}</p>
        <p aria-live="polite" className="mt-1 text-sm font-semibold text-success">
          {state === "saved" && "Dados salvos."}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5">
          <button
            type="button"
            className="inline-flex min-h-11 items-center font-semibold text-action underline underline-offset-2"
            onClick={() => {
              setState("idle");
              setEditing(true);
            }}
          >
            Editar
          </button>
          <Link href="/nova-senha" className="inline-flex min-h-11 items-center font-semibold text-action underline underline-offset-2">
            Trocar senha
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="perfil-nome" className="field-label">
          Nome completo
        </label>
        <input
          id="perfil-nome"
          className="field-input"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setState("idle");
          }}
        />
      </div>
      <div>
        <label htmlFor="perfil-whatsapp" className="field-label">
          WhatsApp
        </label>
        <input
          id="perfil-whatsapp"
          type="tel"
          className="field-input"
          autoComplete="tel-national"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(formatPhone(e.target.value));
            setState("idle");
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={state === "saving"}>
          {state === "saving" && <CircleNotchIcon size={16} className="spinner" aria-hidden />}
          Salvar
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancel} disabled={state === "saving"}>
          Cancelar
        </button>
        <p aria-live="polite" className="text-sm font-semibold">
          {state === "error" && <span className="text-danger">Não foi possível salvar. Tente de novo.</span>}
        </p>
      </div>
    </form>
  );
}
