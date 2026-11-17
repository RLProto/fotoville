/**
 * Pix estático (BR Code do Banco Central) com o valor do pedido.
 * O mesmo texto vira o QR e o "copia e cola". Sem API: a loja confere o
 * recebimento no extrato e marca o pedido como pago no painel.
 */

export const pix = {
  /** CNPJ 44.441.031/0001-53, só os dígitos. */
  key: "44441031000153",
  keyDisplay: "44.441.031/0001-53",
  merchantName: "FOTOVILLE",
  merchantCity: "JOINVILLE",
} as const;

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Só A-Z, 0-9 e espaço, em maiúsculas, como o BR Code exige no nome e na cidade. */
function plain(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), em 4 dígitos hexadecimais. */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Centavos para o formato do BR Code ("12.34"), sem passar por ponto flutuante. */
function amount(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error(`Valor inválido para o Pix: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Código Pix "copia e cola" do pedido. O txid (FV + número) aparece no extrato da loja. */
export function pixCode(order: { number: number; total_cents: number }) {
  const payload =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", pix.key)) +
    field("52", "0000") +
    field("53", "986") +
    field("54", amount(order.total_cents)) +
    field("58", "BR") +
    field("59", plain(pix.merchantName, 25)) +
    field("60", plain(pix.merchantCity, 15)) +
    field("62", field("05", `FV${order.number}`.slice(0, 25))) +
    "6304";
  return payload + crc16(payload);
}
