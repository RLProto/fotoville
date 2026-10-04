import "server-only";
import type { Parcel } from "../types";

/**
 * API oficial dos Correios (CWS): https://cws.correios.com.br
 * Exige contrato com os Correios. No portal "Meu Correios" gere o código de acesso à API
 * e informe o cartão de postagem. Serviços usados: Preço v1 e Prazo v1.
 */

const BASE = process.env.CORREIOS_API_URL ?? "https://api.correios.com.br";

export const hasCorreios = Boolean(
  process.env.CORREIOS_USER && process.env.CORREIOS_ACCESS_CODE && process.env.CORREIOS_POSTAGE_CARD,
);

/** Códigos de serviço do contrato. Confira os do seu cartão de postagem. */
export const CORREIOS_SERVICES = {
  pac: process.env.CORREIOS_SERVICE_PAC ?? "03298",
  sedex: process.env.CORREIOS_SERVICE_SEDEX ?? "03220",
} as const;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const basic = Buffer.from(
    `${process.env.CORREIOS_USER}:${process.env.CORREIOS_ACCESS_CODE}`,
  ).toString("base64");

  const res = await fetch(`${BASE}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ numero: process.env.CORREIOS_POSTAGE_CARD }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Correios token: HTTP ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { token: string; expiraEm: string };
  cachedToken = { value: data.token, expiresAt: new Date(data.expiraEm).getTime() };
  return data.token;
}

async function get<T>(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Correios ${path}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const toCents = (value: string) => Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);

export async function correiosQuote(
  service: keyof typeof CORREIOS_SERVICES,
  cepOrigem: string,
  cepDestino: string,
  parcel: Parcel,
): Promise<{ price_cents: number; days: number }> {
  const code = CORREIOS_SERVICES[service];
  const [price, deadline] = await Promise.all([
    get<{ pcFinal: string }>(`/preco/v1/nacional/${code}`, {
      cepOrigem,
      cepDestino,
      psObjeto: parcel.weight_g, // gramas
      tpObjeto: 2, // 1 envelope, 2 pacote, 3 rolo
      comprimento: parcel.length_cm,
      largura: parcel.width_cm,
      altura: parcel.height_cm,
    }),
    get<{ prazoEntrega: number }>(`/prazo/v1/nacional/${code}`, { cepOrigem, cepDestino }),
  ]);

  const price_cents = toCents(price.pcFinal);
  if (!Number.isFinite(price_cents) || price_cents <= 0) throw new Error("Correios: preço inválido");
  return { price_cents, days: Number(deadline.prazoEntrega) };
}
