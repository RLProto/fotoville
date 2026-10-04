"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPhone, onlyDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({ userId, initial }: { userId: string; initial: { name: string; whatsapp: string } }) {
  const router = useRouter();
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
    if (!error) router.refresh();
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
        <p aria-live="polite" className="text-sm font-semibold">
          {state === "saved" && <span className="text-success">Dados salvos.</span>}
          {state === "error" && <span className="text-danger">Não foi possível salvar.</span>}
        </p>
      </div>
    </form>
  );
}
