"use client";

import { CircleNotchIcon, LockIcon, StorefrontIcon, TruckIcon } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import { formatBRL, formatCep, formatCpf, formatPhone, isValidCpf, onlyDigits } from "@/lib/format";
import { reportError } from "@/lib/report-error";
import type { ShippingOption } from "@/lib/types";

type Line = { key: string; label: string; total_cents: number };
type Coupon = { code: string; discount_cents: number; message: string };
type Errors = Partial<Record<string, string>>;

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Sem resposta (a conexão caiu): o servidor não chega a saber, então o registro sai daqui.
    reportError("checkout", err, { url, etapa: "conexão" }, "warning");
    throw new Error("Sem conexão com o site. Confira a internet e tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Erros 500 o servidor já registra. Uma recusa ao fechar o pedido também interessa investigar.
    if (res.status < 500 && url === "/api/checkout") {
      reportError("checkout", data.error ?? `HTTP ${res.status}`, { url, status: res.status }, "warning");
    }
    throw new Error(data.error ?? "Algo deu errado. Tente de novo.");
  }
  return data as T;
}

export function CheckoutForm({
  lines,
  subtotalCents,
  productionDays,
  pickupAddress,
  initial,
}: {
  lines: Line[];
  subtotalCents: number;
  productionDays: number;
  pickupAddress: string;
  initial: { name: string; cpf: string; whatsapp: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [customer, setCustomer] = useState({
    name: initial.name,
    cpf: formatCpf(initial.cpf),
    whatsapp: formatPhone(initial.whatsapp),
  });
  const [mode, setMode] = useState<"entrega" | "retirada">("entrega");
  const [address, setAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [service, setService] = useState<ShippingOption["service"] | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cepDigits = onlyDigits(address.cep);

  /** Identifica a cotação mais recente, para descartar respostas de um CEP já trocado. */
  const quoteSeq = useRef(0);

  // CEP completo: preenche o endereço (ViaCEP) e cota o frete para o carrinho.
  function onCepChange(value: string) {
    const cep = formatCep(value);
    const digits = onlyDigits(cep);
    setAddress((a) => ({ ...a, cep }));
    clear("cep");
    if (digits === cepDigits) return;

    const seq = ++quoteSeq.current;
    setOptions(null);
    setService(null);
    setQuoteError(null);
    setQuoting(digits.length === 8);
    if (digits.length !== 8) return;

    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((res) => res.json())
      .then((data) => {
        if (seq !== quoteSeq.current || data.erro) return;
        setAddress((a) => ({
          ...a,
          street: data.logradouro || a.street,
          district: data.bairro || a.district,
          city: data.localidade || a.city,
          state: data.uf || a.state,
        }));
      })
      .catch(() => {}); // sem ViaCEP o cliente digita o endereço

    post<{ options: ShippingOption[] }>("/api/frete", { cep: digits })
      .then(({ options }) => {
        if (seq !== quoteSeq.current) return;
        const delivery = options.filter((o) => o.service !== "retirada");
        setOptions(delivery);
        setService(delivery[0]?.service ?? null);
      })
      .catch((err) => seq === quoteSeq.current && setQuoteError(err.message))
      .finally(() => seq === quoteSeq.current && setQuoting(false));
  }

  const selected = mode === "retirada" ? null : (options?.find((o) => o.service === service) ?? null);
  const shippingCents = mode === "retirada" ? 0 : (selected?.price_cents ?? null);
  const discountCents = Math.min(coupon?.discount_cents ?? 0, subtotalCents);
  const totalCents = subtotalCents - discountCents + (shippingCents ?? 0);

  async function applyCoupon() {
    setCouponLoading(true);
    setCouponError(null);
    try {
      setCoupon(await post<Coupon>("/api/cupom", { code: couponInput }));
    } catch (err) {
      setCoupon(null);
      setCouponError(err instanceof Error ? err.message : "Cupom inválido.");
    } finally {
      setCouponLoading(false);
    }
  }

  function validate(): Errors {
    const e: Errors = {};
    if (customer.name.trim().length < 3) e.name = "Informe seu nome completo.";
    if (!isValidCpf(customer.cpf)) e.cpf = "CPF inválido. Confira os 11 dígitos.";
    if (onlyDigits(customer.whatsapp).length < 10) e.whatsapp = "Informe o WhatsApp com DDD.";
    if (mode === "entrega") {
      if (cepDigits.length !== 8) e.cep = "Informe o CEP com 8 dígitos.";
      else if (!selected) e.cep = "Aguarde o cálculo do frete e escolha uma opção.";
      if (!address.street.trim()) e.street = "Informe a rua.";
      if (!address.number.trim()) e.number = "Informe o número.";
      if (!address.district.trim()) e.district = "Informe o bairro.";
      if (!address.city.trim()) e.city = "Informe a cidade.";
      if (!address.state) e.state = "Escolha o estado.";
    }
    return e;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const { redirect } = await post<{ redirect: string }>("/api/checkout", {
        customer,
        service: mode === "retirada" ? "retirada" : service,
        address: mode === "entrega" ? address : undefined,
        coupon: coupon?.code,
      });
      window.location.assign(redirect);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Não foi possível concluir o pedido.");
      setSubmitting(false);
    }
  }

  const clear = (name: string) => setErrors((e) => ({ ...e, [name]: undefined }));

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <fieldset className="card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full text-xl font-bold">Seus dados</legend>
          <div className="clear-both grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" name="name" error={errors.name} className="sm:col-span-2">
              {(props) => (
                <input
                  {...props}
                  autoComplete="name"
                  value={customer.name}
                  onChange={(e) => {
                    setCustomer({ ...customer, name: e.target.value });
                    clear("name");
                  }}
                />
              )}
            </Field>
            <Field label="CPF" name="cpf" error={errors.cpf} hint="Necessário para o envio.">
              {(props) => (
                <input
                  {...props}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={customer.cpf}
                  onChange={(e) => {
                    setCustomer({ ...customer, cpf: formatCpf(e.target.value) });
                    clear("cpf");
                  }}
                />
              )}
            </Field>
            <Field label="WhatsApp" name="whatsapp" error={errors.whatsapp} hint="Para avisos do pedido.">
              {(props) => (
                <input
                  {...props}
                  type="tel"
                  autoComplete="tel-national"
                  placeholder="(47) 99999-9999"
                  value={customer.whatsapp}
                  onChange={(e) => {
                    setCustomer({ ...customer, whatsapp: formatPhone(e.target.value) });
                    clear("whatsapp");
                  }}
                />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full text-xl font-bold">Entrega</legend>
          <div className="clear-both grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Como você quer receber">
            {(
              [
                { value: "entrega", title: "Receber em casa", text: "Correios, para todo o Brasil", Icon: TruckIcon },
                { value: "retirada", title: "Retirar na loja", text: "Sem frete, em Joinville", Icon: StorefrontIcon },
              ] as const
            ).map(({ value, title, text, Icon }) => (
              <label
                key={value}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-panel border-2 p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-action ${
                  mode === value ? "border-action bg-action-soft" : "border-rule hover:border-ink-2"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                <Icon size={24} className="shrink-0 text-action" aria-hidden />
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-sm text-ink-2">{text}</span>
                </span>
              </label>
            ))}
          </div>

          {mode === "retirada" ? (
            <p className="alert alert-info mt-5">
              <StorefrontIcon size={20} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                <strong>{pickupAddress}</strong>. Avisamos pelo WhatsApp quando estiver pronto.
              </span>
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="max-w-52">
                <Field label="CEP" name="cep" error={errors.cep}>
                  {(props) => (
                    <input
                      {...props}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      value={address.cep}
                      onChange={(e) => onCepChange(e.target.value)}
                    />
                  )}
                </Field>
              </div>

              <div aria-live="polite">
                {quoting && (
                  <p className="flex items-center gap-2 text-ink-2" role="status">
                    <CircleNotchIcon size={18} className="spinner" aria-hidden />
                    Calculando o frete…
                  </p>
                )}
                {quoteError && (
                  <p className="alert alert-danger" role="alert">
                    {quoteError}
                  </p>
                )}
                {options && (
                  <div role="radiogroup" aria-label="Opções de frete" className="space-y-2">
                    {options.map((option) => (
                      <label
                        key={option.service}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-panel border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-action ${
                          service === option.service ? "border-action bg-action-soft" : "border-rule hover:border-ink-2"
                        }`}
                      >
                        <input
                          type="radio"
                          name="service"
                          value={option.service}
                          checked={service === option.service}
                          onChange={() => setService(option.service)}
                          className="size-5 accent-action"
                        />
                        <span className="flex-1">
                          <span className="block font-bold">{option.label}</span>
                          <span className="block text-sm text-ink-2">
                            Até {productionDays + option.days} dias úteis
                          </span>
                        </span>
                        <span className="font-display font-bold tabular-nums">
                          {option.estimated && <span className="text-sm font-normal text-ink-2">aprox. </span>}
                          {formatBRL(option.price_cents)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {cepDigits.length === 8 && (
                <div className="grid gap-4 sm:grid-cols-6">
                  <Field label="Rua" name="street" error={errors.street} className="sm:col-span-4">
                    {(props) => (
                      <input
                        {...props}
                        autoComplete="address-line1"
                        value={address.street}
                        onChange={(e) => {
                          setAddress({ ...address, street: e.target.value });
                          clear("street");
                        }}
                      />
                    )}
                  </Field>
                  <Field label="Número" name="number" error={errors.number} className="sm:col-span-2">
                    {(props) => (
                      <input
                        {...props}
                        value={address.number}
                        onChange={(e) => {
                          setAddress({ ...address, number: e.target.value });
                          clear("number");
                        }}
                      />
                    )}
                  </Field>
                  <Field label="Complemento (opcional)" name="complement" className="sm:col-span-3">
                    {(props) => (
                      <input
                        {...props}
                        aria-required={false}
                        autoComplete="address-line2"
                        placeholder="Apto, bloco, casa"
                        value={address.complement}
                        onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Bairro" name="district" error={errors.district} className="sm:col-span-3">
                    {(props) => (
                      <input
                        {...props}
                        value={address.district}
                        onChange={(e) => {
                          setAddress({ ...address, district: e.target.value });
                          clear("district");
                        }}
                      />
                    )}
                  </Field>
                  <Field label="Cidade" name="city" error={errors.city} className="sm:col-span-4">
                    {(props) => (
                      <input
                        {...props}
                        autoComplete="address-level2"
                        value={address.city}
                        onChange={(e) => {
                          setAddress({ ...address, city: e.target.value });
                          clear("city");
                        }}
                      />
                    )}
                  </Field>
                  <Field label="Estado" name="state" error={errors.state} className="sm:col-span-2">
                    {(props) => (
                      <select
                        {...props}
                        autoComplete="address-level1"
                        value={address.state}
                        onChange={(e) => {
                          setAddress({ ...address, state: e.target.value });
                          clear("state");
                        }}
                      >
                        <option value="">UF</option>
                        {UFS.map((uf) => (
                          <option key={uf}>{uf}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              )}
            </div>
          )}
        </fieldset>

      </div>

      <aside className="card p-5 lg:sticky lg:top-24" aria-labelledby="resumo-pedido">
        <h2 id="resumo-pedido" className="text-xl font-bold">
          Resumo do pedido
        </h2>
        <dl className="mt-4 space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="flex justify-between gap-4">
              <dt className="text-ink/85">{line.label}</dt>
              <dd className="font-semibold tabular-nums">{formatBRL(line.total_cents)}</dd>
            </div>
          ))}
          {discountCents > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt className="font-semibold">Cupom</dt>
              <dd className="font-semibold tabular-nums">− {formatBRL(discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-ink/85">Frete</dt>
            <dd className="font-semibold tabular-nums">
              {shippingCents === null ? "Informe o CEP" : shippingCents === 0 ? "Grátis" : formatBRL(shippingCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-rule pt-3 text-xl">
            <dt className="font-bold">Total</dt>
            <dd className="font-display font-bold text-ink tabular-nums" aria-live="polite">
              {formatBRL(totalCents)}
            </dd>
          </div>
        </dl>

        {/* Cupom: só aqui, junto do pagamento, e recolhido para não distrair quem não tem */}
        <div className="mt-4 border-t border-rule pt-3">
          {coupon ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-success" role="status">
              Cupom {coupon.code} aplicado. {coupon.message}
              <button
                type="button"
                className="inline-flex min-h-11 items-center font-bold text-danger underline underline-offset-2"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput("");
                }}
              >
                Remover
              </button>
            </p>
          ) : !couponOpen ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center text-sm font-bold text-action underline underline-offset-2"
              aria-expanded={false}
              onClick={() => setCouponOpen(true)}
            >
              Tem um cupom?
            </button>
          ) : (
            <div className="pt-1">
              <label htmlFor="cupom" className="field-label">
                Cupom
              </label>
              <div className="flex gap-2">
                <input
                  id="cupom"
                  name="cupom"
                  spellCheck={false}
                  autoFocus
                  className="field-input min-w-0 flex-1 uppercase"
                  placeholder="FV-XXXX-XXXX"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={couponInput}
                  aria-invalid={Boolean(couponError)}
                  aria-describedby="cupom-status"
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponInput.trim()) applyCoupon();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline shrink-0"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                >
                  {couponLoading && <CircleNotchIcon size={18} className="spinner" aria-hidden />}
                  Aplicar
                </button>
              </div>
              <div id="cupom-status" aria-live="polite">
                {couponError ? (
                  <p className="field-error">{couponError}</p>
                ) : (
                  <p className="field-hint">Um cupom por pedido.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <p className="alert alert-danger mt-4" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="btn btn-accent btn-lg mt-5 w-full" disabled={submitting}>
          {submitting ? <CircleNotchIcon size={20} className="spinner" aria-hidden /> : <LockIcon size={18} aria-hidden />}
          {submitting ? "Criando pedido…" : totalCents === 0 ? "Concluir pedido" : "Ir para o pagamento"}
        </button>
        <p className="mt-3 text-center text-sm text-ink-2">
          Pix, cartão ou boleto pelo Mercado Pago.
        </p>
      </aside>
    </form>
  );
}

/** Campo com rótulo visível, dica e erro ligados ao input por aria-describedby. */
function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    name: string;
    className: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    "aria-required": boolean;
  }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-erro` : hint ? `${id}-dica` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({
        id,
        name,
        className: "field-input",
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        "aria-required": true,
      })}
      {error ? (
        <p id={`${id}-erro`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-dica`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
