export type Finish = "brilho" | "fosco";

/** Faixa do desconto progressivo: a partir de `min` cópias do tamanho no pedido, cada foto custa `price_cents`. */
export type PriceTier = { min: number; price_cents: number };

export type Product = {
  id: string;
  name: string;
  kind: "print" | "polaroid" | "placa";
  width_cm: number;
  height_cm: number;
  price_cents: number;
  price_tiers: PriceTier[];
  /** Tabela da loja, presente só quando o perfil do cliente mudou o preço deste tamanho (para mostrar riscado). */
  store?: { price_cents: number; price_tiers: PriceTier[] };
  finishes: Finish[];
  unit_weight_g: number | null;
  unit_thickness_mm: number | null;
  sort: number;
  active: boolean;
};

export type Package = {
  id: string;
  name: string;
  product_id: string;
  photo_count: number;
  price_cents: number;
  description: string | null;
  sort: number;
  active: boolean;
};

export type Crop = { x: number; y: number; width: number; height: number };

/** Correção calculada pelo ajuste automático a partir do histograma da foto. */
export type AutoTone = {
  /** Ganho de vermelho, verde e azul (balanço de branco). */
  gains: [number, number, number];
  /** Pontos de preto e branco na luminância, de 0 a 1. */
  black: number;
  white: number;
  /** Abaixo de 1 clareia os meios-tons; acima de 1 escurece. */
  gamma: number;
  /** Quanto clarear as sombras, de 0 a 1. */
  shadows: number;
  /** Reforço das cores pouco saturadas, de 0 a 1. */
  vibrance: number;
};

export type BorderColor = "branco" | "marfim" | "preto" | "rosa" | "azul" | "salvia" | "mostarda" | "terracota";
export type CaptionFont = "caneta" | "caligrafia" | "classica" | "maquina" | "retro";

/** Ajustes de imagem e de papel. A foto original nunca é alterada; tudo é aplicado na hora de imprimir. */
export type Adjust = {
  auto: AutoTone | null;
  /** De -100 a 100. */
  brightness: number;
  contrast: number;
  saturation: number;
  bw: boolean;
  /** Borda de cor uniforme (não vale para Polaroid). */
  border: { color: BorderColor; mm: number } | null;
  /** Texto na faixa de baixo (só Polaroid). */
  caption: { text: string; font: CaptionFont } | null;
};

export type Photo = {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string | null;
  storage_key: string;
  thumb_key: string | null;
  file_name: string;
  width_px: number;
  height_px: number;
  crop: Crop | null;
  fit: boolean;
  adjust: Adjust | null;
  finish: Finish;
  quantity: number;
  created_at: string;
};

/** Foto com URL temporária da miniatura, pronta para a interface. */
export type PhotoView = Photo & { thumb_url: string | null };

export type Address = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
};

export type Customer = { name: string; cpf: string; whatsapp: string; email: string };

export type Parcel = { weight_g: number; length_cm: number; width_cm: number; height_cm: number };

export type ShippingOption = {
  service: "pac" | "sedex" | "retirada";
  label: string;
  price_cents: number;
  /** Dias úteis de transporte, sem contar a produção. */
  days: number;
  /** true quando o valor veio da tabela de estimativa e não da API dos Correios. */
  estimated: boolean;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "in_production"
  | "shipped"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  number: number;
  user_id: string;
  kind: "prints" | "package";
  /** Perfil de preço do cliente no momento da compra (null = tabela da loja). */
  price_profile_name: string | null;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  package_id: string | null;
  customer: Customer | null;
  shipping_service: ShippingOption["service"] | null;
  shipping_label: string | null;
  shipping_days: number | null;
  shipping_estimated: boolean;
  shipping_address: Address | null;
  parcel: Parcel | null;
  tracking_code: string | null;
  mp_preference_id: string | null;
  mp_init_point: string | null;
  mp_payment_id: string | null;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  description: string;
  finish: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type Coupon = {
  code: string;
  kind: "credits" | "percent";
  user_id: string | null;
  product_id: string | null;
  credits_total: number;
  credits_used: number;
  percent_off: number | null;
  source_order_id: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pagamento aprovado",
  in_production: "Em produção",
  shipped: "Enviado",
  ready_for_pickup: "Pronto para retirada",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const FINISH_LABEL: Record<Finish, string> = { brilho: "Brilho", fosco: "Fosco" };

/** Preço e desconto progressivo de um tamanho numa tabela (da loja ou de um perfil de cliente). */
export type PriceRow = { product_id: string; price_cents: number; price_tiers: PriceTier[] };

/** Perfil de preço (cliente preferencial) com a tabela dele por tamanho. */
export type CustomerPriceProfile = { id: string; name: string; prices: Map<string, Omit<PriceRow, "product_id">> };
