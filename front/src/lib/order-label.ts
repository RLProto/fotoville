/**
 * Etiquetas do envelope, em PDF A4 na grade da folha Pimaco CA4354 (22 etiquetas de 99 x 25,4 mm,
 * duas colunas). Uma etiqueta por pedido: cliente, endereço ou retirada, tamanhos e código de barras.
 * Gerado no navegador do painel, junto com as fotos.
 */
import fontkit from "@pdf-lib/fontkit";
import JsBarcode from "jsbarcode";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { sizeName } from "./catalog-data";
import { formatCep } from "./format";
import type { Order, OrderItem, Product } from "./types";

/** Geometria da folha, em mm. Ajuste aqui se a impressora deslocar as etiquetas. */
export const LABEL_SHEET = {
  name: "CA4354",
  cols: 2,
  rows: 11,
  width: 99,
  height: 25.4,
  left: 6,
  top: 8.8,
  gapX: 0,
  gapY: 0,
};
export const LABELS_PER_SHEET = LABEL_SHEET.cols * LABEL_SHEET.rows;

/** Quantos tamanhos cabem numa etiqueta; o pedido que passar disso ganha outra. */
export const SIZES_PER_LABEL = 6;

export type LabelAddress = {
  street: string;
  /** Separado da rua: é o que nunca pode ser cortado. */
  number: string;
  complement?: string;
  district: string;
  /** "Joinville - SC" */
  city: string;
  /** "CEP 89219-160" */
  cep: string;
};

export type LabelData = {
  number: number;
  customer: string;
  /** null: retirada na loja. */
  address: LabelAddress | null;
  /** "10x15 (3 fotos)": o primeiro fica embaixo, os outros sobem. */
  sizes: string[];
};

/** Uma etiqueta por pedido, com os tamanhos na ordem do catálogo; pedido com tamanhos demais ganha outra. */
export function labelsFor(
  order: Pick<Order, "number" | "customer" | "shipping_service" | "shipping_address">,
  items: Pick<OrderItem, "product_id" | "quantity">[],
  products: Pick<Product, "id" | "name" | "sort">[],
): LabelData[] {
  const { customer, shipping_address: address } = order;

  const copies = new Map<string, number>();
  for (const item of items) {
    if (item.product_id) copies.set(item.product_id, (copies.get(item.product_id) ?? 0) + item.quantity);
  }
  const sizes = products
    .filter((p) => copies.has(p.id))
    .sort((a, b) => a.sort - b.sort)
    .map((p) => {
      const count = copies.get(p.id)!;
      return `${sizeName(p)} (${count} ${count === 1 ? "foto" : "fotos"})`;
    });

  const base = {
    number: order.number,
    customer: customer?.name?.toLocaleUpperCase("pt-BR") || customer?.email || "SEM NOME",
    address:
      order.shipping_service === "retirada" || !address
        ? null
        : {
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: `${address.city} - ${address.state}`,
            cep: `CEP ${formatCep(address.cep)}${order.shipping_service === "motoboy" ? " - MOTOBOY" : ""}`,
          },
  };
  const labels: LabelData[] = [];
  for (let i = 0; i < Math.max(1, sizes.length); i += SIZES_PER_LABEL) {
    labels.push({ ...base, sizes: sizes.slice(i, i + SIZES_PER_LABEL) });
  }
  return labels;
}

/** Cobre latim com acentos de todas as línguas, grego, cirílico e muitos símbolos. Servida em public/fonts. */
const FONT_URL = "/fonts/DejaVuSans.ttf";

const A4 = { width: 210, height: 297 };
const PT = 72 / 25.4;
const mm = (v: number) => v * PT;
const INK = rgb(0, 0, 0);

const PAD_X = mm(4);
const PAD_Y = mm(2.6);
const LINE = mm(2.75);
const NAME_SIZE = 7.5;
const NAME_MIN_SIZE = 5.5;
const TEXT_SIZE = 7;
const SMALL_SIZE = 6;
const MIN_SIZE = 5;
const NUMBER_SIZE = 10;
/** Largura da barra mais fina do código e altura das barras. */
const BAR_MODULE = mm(0.33);
const BAR_HEIGHT = mm(8);
/** Margem em branco que o leitor precisa ao lado das barras: dez barras finas. */
const BAR_QUIET = 10 * BAR_MODULE;
const RULE_WIDTH = mm(36);

/**
 * Só o que a fonte sabe desenhar: sem isso sai quadradinho no lugar da letra. Letra que a fonte não tem
 * perde o acento antes de ser descartada; emoji e o resto saem.
 */
function printable(text: string, font: PDFFont) {
  const known = new Set(font.getCharacterSet());
  const has = (char: string) => known.has(char.codePointAt(0)!);
  return Array.from(text.normalize("NFC"), (char) => {
    if (/\s/.test(char)) return " ";
    if (has(char)) return char;
    return Array.from(char.normalize("NFD")).filter(has).join("");
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Corta o texto com reticências para caber na largura, em pontos. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && font.widthOfTextAtSize(`${chars.join("")}...`, size) > maxWidth) chars.pop();
  return `${chars.join("").trimEnd()}...`;
}

/** Quebra por palavras em até `maxLines` linhas; a última é cortada com reticências se precisar. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || lines.length === maxLines - 1 || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.map((line) => fit(line, font, size, maxWidth));
}

/** Maior corpo em que o texto cabe inteiro nas linhas; não cabendo nem no menor, fica no menor. */
function shrinkToFit(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  for (let s = size; s > MIN_SIZE; s -= 0.5) {
    if (wrap(text, font, s, maxWidth, maxLines).join(" ") === text) return s;
  }
  return MIN_SIZE;
}

/** Rua e número em até `maxLines` linhas. Sem espaço, corta o nome da rua e mantém o número. */
function streetRows(street: string, number: string, font: PDFFont, maxWidth: number, maxLines: number) {
  const full = number ? `${street}, ${number}` : street;
  const size = shrinkToFit(full, font, TEXT_SIZE, maxWidth, maxLines);
  const chars = Array.from(street);
  let text = full;
  while (chars.length > 1 && number && wrap(text, font, size, maxWidth, maxLines).join(" ") !== text) {
    chars.pop();
    text = `${chars.join("").trimEnd()}..., ${number}`;
  }
  return wrap(text, font, size, maxWidth, maxLines).map((value) => ({ value, size }));
}

/** Barras do Code 128: cada "1" do resultado é uma barra fina preta, cada "0" um espaço. */
function barcodeModules(value: string) {
  const out: { encodings?: { data: string }[] } = {};
  JsBarcode(out, value, { format: "CODE128" });
  return (out.encodings ?? []).map((e) => e.data).join("");
}

/** Posição da etiqueta `index` (0 = primeira da folha) no papel, em pontos, pelo canto de baixo. */
function slot(index: number) {
  const col = index % LABEL_SHEET.cols;
  const row = Math.floor(index / LABEL_SHEET.cols);
  const x = LABEL_SHEET.left + col * (LABEL_SHEET.width + LABEL_SHEET.gapX);
  const yTop = LABEL_SHEET.top + row * (LABEL_SHEET.height + LABEL_SHEET.gapY);
  return {
    x: mm(x),
    y: mm(A4.height - yTop - LABEL_SHEET.height),
    w: mm(LABEL_SHEET.width),
    h: mm(LABEL_SHEET.height),
  };
}

function drawLabel(page: PDFPage, font: PDFFont, label: LabelData, box: ReturnType<typeof slot>) {
  const text = (value: string, x: number, y: number, size = TEXT_SIZE) =>
    page.drawText(value, { x, y, size, font, color: INK });
  const left = box.x + PAD_X;
  const right = box.x + box.w - PAD_X;
  const base = box.y + PAD_Y;
  const nameY = box.y + box.h - PAD_Y - NAME_SIZE * 0.75;

  // Nome em cima, na largura toda: encolhe antes de cortar
  const name = printable(label.customer, font) || "SEM NOME";
  const shrunk = (NAME_SIZE * (right - left)) / font.widthOfTextAtSize(name, NAME_SIZE);
  const nameSize = Math.max(NAME_MIN_SIZE, Math.min(NAME_SIZE, shrunk));
  text(fit(name, font, nameSize, right - left), left, nameY, nameSize);

  // Código de barras à direita, com o número embaixo
  const number = `#${label.number}`;
  const modules = barcodeModules(String(label.number));
  const barW = modules.length * BAR_MODULE;
  const barX = right - barW;
  text(number, barX + (barW - font.widthOfTextAtSize(number, NUMBER_SIZE)) / 2, base, NUMBER_SIZE);
  for (const run of modules.matchAll(/1+/g)) {
    page.drawRectangle({
      x: barX + run.index * BAR_MODULE,
      y: base + NUMBER_SIZE + mm(0.3),
      width: run[0].length * BAR_MODULE,
      height: BAR_HEIGHT,
      color: INK,
    });
  }

  // Tamanhos na margem do código, de baixo para cima
  const sizes = label.sizes.map((s) => printable(s, font));
  const sizesW = Math.max(0, ...sizes.map((s) => font.widthOfTextAtSize(s, TEXT_SIZE)));
  const sizesX = barX - BAR_QUIET - sizesW;
  sizes.forEach((s, i) => text(s, sizesX, base + i * LINE));

  // Bloco da esquerda: retirada entre dois fios, ou o endereço apoiado na base
  const blockW = sizesX - mm(2) - left;
  if (!label.address) {
    const ruleW = Math.min(RULE_WIDTH, blockW);
    const rule = (y: number) =>
      page.drawLine({
        start: { x: left, y },
        end: { x: left + ruleW, y },
        thickness: 0.5,
        color: INK,
        dashArray: [1.6, 1.2],
      });
    const y = nameY - mm(5);
    rule(y + mm(2.6));
    text(fit("RETIRADA NA LOJA", font, TEXT_SIZE, blockW), left, y);
    rule(y - mm(1.3));
    return;
  }

  const { street, number: houseNumber, complement, district, city, cep } = label.address;
  // Cabem seis linhas abaixo do nome; bairro, cidade e CEP usam três, rua e complemento dividem o resto
  const note = printable(complement ?? "", font);
  const streetLines = streetRows(printable(street, font), printable(houseNumber, font), font, blockW, note ? 2 : 3);
  const noteRoom = 3 - streetLines.length;
  const noteSize = note ? shrinkToFit(note, font, SMALL_SIZE, blockW, noteRoom) : SMALL_SIZE;
  const noteLines = note ? wrap(note, font, noteSize, blockW, noteRoom) : [];
  const rows = [
    ...streetLines,
    ...noteLines.map((value) => ({ value, size: noteSize })),
    ...[district, city, cep].map((value) => ({
      value: fit(printable(value, font), font, TEXT_SIZE, blockW),
      size: TEXT_SIZE,
    })),
  ];
  rows.forEach((row, i) => text(row.value, left, base + (rows.length - 1 - i) * LINE, row.size));
}

/** PDF com as etiquetas a partir da posição `startAt` (1 a 22) da folha; passa de folha quando precisa. */
export async function buildLabelsPdf(labels: LabelData[], startAt = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Etiquetas Fotoville");
  doc.registerFontkit(fontkit);
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`Fonte da etiqueta: HTTP ${response.status}`);
  const font = await doc.embedFont(await response.arrayBuffer(), { subset: true });
  const pages: PDFPage[] = [];
  const first = Math.min(LABELS_PER_SHEET, Math.max(1, Math.round(startAt))) - 1;

  for (const [i, label] of labels.entries()) {
    const absolute = first + i;
    const pageIndex = Math.floor(absolute / LABELS_PER_SHEET);
    while (pages.length <= pageIndex) pages.push(doc.addPage([mm(A4.width), mm(A4.height)]));
    drawLabel(pages[pageIndex], font, label, slot(absolute % LABELS_PER_SHEET));
  }

  return doc.save();
}
