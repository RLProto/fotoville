export const site = {
  name: "Fotoville",
  tagline: "Revelação fotográfica",
  description:
    "Revelação química de fotos em papel Fujifilm, a partir de R$ 1,99 por foto. Entrega em todo o Brasil e retirada grátis em Joinville/SC.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  whatsapp: "554730293792",
  whatsappDisplay: "(47) 3029-3792",
  email: "fotoville.com.br@gmail.com",
  since: 2012,
  /** Dias úteis para produzir o pedido antes de postar. Confirmar com a loja. */
  productionDays: 3,
  address: {
    street: "R. Vice-Prefeito Luiz Carlos Garcia, 1125 - Sala 3",
    district: "Costa e Silva",
    city: "Joinville",
    state: "SC",
    cep: "89219-370",
  },
} as const;

export function whatsappLink(message = "Olá, vim pelo site da Fotoville.") {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
