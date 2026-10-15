/**
 * Etiquetas do envelope, em PDF A4 na grade da folha Pimaco CA4354 (22 etiquetas de 99 x 25,4 mm,
 * duas colunas). Uma etiqueta por tamanho do pedido, com QR code que abre o pedido no painel.
 * Gerado no navegador do painel, junto com as fotos.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

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

export type LabelData = {
  number: number;
  customer: string;
  /** Endereço ou "RETIRADA NA LOJA", mais o WhatsApp: até quatro linhas. */
  lines: string[];
  /** "10x15", "Polaroid"… */
  size: string;
  copies: number;
  /** O que o QR code abre. */
  url: string;
};

const A4 = { width: 210, height: 297 };
const PT = 72 / 25.4;
const mm = (v: number) => v * PT;
const INK = rgb(0.106, 0.122, 0.2);
const MUTED = rgb(0.306, 0.329, 0.416);

/** As fontes padrão do PDF só têm Latin-1: tira o resto (emoji, símbolos). */
function latin1(text: string) {
  return text
    .normalize("NFC")
    .replace(/[^ -~ -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Corta o texto com reticências para caber na largura, em pontos. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Quebra por palavras em até `maxLines` linhas; a última é cortada com reticências se precisar. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const rest = words.slice(lines.join(" ").split(" ").length).join(" ");
  if (rest && lines.length) lines[lines.length - 1] = fit(`${lines[lines.length - 1]} ${rest}`, font, size, maxWidth);
  return lines.map((l) => fit(l, font, size, maxWidth));
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

/** PDF com as etiquetas a partir da posição `startAt` (1 a 22) da folha; passa de folha quando precisa. */
export async function buildLabelsPdf(labels: LabelData[], startAt = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Etiquetas Fotoville");
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const pages: PDFPage[] = [];
  const first = Math.min(LABELS_PER_SHEET, Math.max(1, Math.round(startAt))) - 1;

  for (const [i, label] of labels.entries()) {
    const absolute = first + i;
    const pageIndex = Math.floor(absolute / LABELS_PER_SHEET);
    while (pages.length <= pageIndex) pages.push(doc.addPage([mm(A4.width), mm(A4.height)]));
    const page = pages[pageIndex];
    const box = slot(absolute % LABELS_PER_SHEET);
    const pad = mm(2.5);

    // QR code à direita, quadrado, na altura toda menos a margem
    const qrSize = box.h - 2 * pad;
    const qrPng = await QRCode.toDataURL(label.url, { margin: 0, scale: 6, errorCorrectionLevel: "M" });
    const qr = await doc.embedPng(qrPng);
    const qrX = box.x + box.w - pad - qrSize;
    page.drawImage(qr, { x: qrX, y: box.y + pad, width: qrSize, height: qrSize });

    // Bloco da direita, encostado no QR: número do pedido, tamanho e quantidade
    const rightW = mm(24);
    const rightX = qrX - mm(2) - rightW;
    const right = (text: string, font: PDFFont, size: number, y: number, color = INK) => {
      const t = fit(latin1(text), font, size, rightW);
      page.drawText(t, { x: rightX + rightW - font.widthOfTextAtSize(t, size), y, size, font, color });
    };
    right(`#${label.number}`, bold, 11, box.y + box.h - pad - 9);
    right(label.size, bold, 10, box.y + pad + mm(4.4));
    right(`${label.copies} ${label.copies === 1 ? "foto" : "fotos"}`, regular, 7.5, box.y + pad + 1, MUTED);

    // Bloco da esquerda: cliente (até duas linhas) e endereço, cinco linhas no total
    const leftX = box.x + pad;
    const leftW = rightX - mm(2) - leftX;
    const MAX_LINES = 6;
    const name = wrap(latin1(label.customer), bold, 7.6, leftW, 2);
    const rows: { text: string; font: PDFFont; size: number }[] = name.map((text) => ({ text, font: bold, size: 7.6 }));
    for (const [i, line] of label.lines.entries()) {
      const room = MAX_LINES - rows.length;
      if (room <= 0) break;
      // A rua e o número podem ocupar duas linhas quando sobra espaço; as outras, uma
      const remaining = label.lines.length - i - 1;
      const max = i === 0 ? Math.max(1, Math.min(2, room - remaining)) : 1;
      for (const text of wrap(latin1(line), regular, 6.6, leftW, max)) rows.push({ text, font: regular, size: 6.6 });
    }
    let y = box.y + box.h - pad - 7;
    for (const row of rows) {
      page.drawText(row.text, { x: leftX, y, size: row.size, font: row.font, color: INK });
      y -= mm(2.85);
    }
  }

  return doc.save();
}
