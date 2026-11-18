/** Leitura do cabeçalho de arquivos HEIC/HEIF. */

/** Marcas do ftyp de HEIF com HEVC (fotos de iPhone e de Android). */
const HEVC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

function fourcc(bytes: Uint8Array, at: number) {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

/** Diz se o começo do arquivo é HEIC, qualquer que seja a extensão. AVIF fica de fora: o navegador já abre. */
export function isHeicHeader(bytes: Uint8Array) {
  if (bytes.length < 12 || fourcc(bytes, 4) !== "ftyp") return false;
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const brands = [fourcc(bytes, 8)];
  for (let at = 16; at + 4 <= Math.min(size, bytes.length); at += 4) brands.push(fourcc(bytes, at));
  if (brands.some((b) => HEVC_BRANDS.has(b))) return true;
  return (brands[0] === "mif1" || brands[0] === "msf1") && !brands.some((b) => b === "avif" || b === "avis");
}

/** Espaço de cor da foto (caixas `colr`). iPhone grava em Display P3; lido como sRGB, sai desbotado. */
export function heicColorSpace(bytes: Uint8Array): PredefinedColorSpace {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  while (pos + 8 <= bytes.length) {
    let size = view.getUint32(pos);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > bytes.length) break;
      size = Number(view.getBigUint64(pos + 8));
      header = 16;
    } else if (size === 0) size = bytes.length - pos;
    if (size < header) break;
    if (fourcc(bytes, pos + 4) === "meta") return colorSpaceInMeta(bytes, view, pos + header, Math.min(bytes.length, pos + size));
    pos += size;
  }
  return "srgb";
}

function colorSpaceInMeta(bytes: Uint8Array, view: DataView, start: number, end: number): PredefinedColorSpace {
  for (let at = start + 4; at + 12 <= end; at++) {
    // "colr"
    if (bytes[at] !== 0x63 || bytes[at + 1] !== 0x6f || bytes[at + 2] !== 0x6c || bytes[at + 3] !== 0x72) continue;
    const boxEnd = Math.min(end, at - 4 + view.getUint32(at - 4));
    const kind = fourcc(bytes, at + 4);
    // nclx: primárias 11 (DCI-P3) e 12 (Display P3)
    if (kind === "nclx" && at + 10 <= boxEnd && [11, 12].includes(view.getUint16(at + 8))) return "display-p3";
    if ((kind === "prof" || kind === "rICC") && isP3Profile(bytes.subarray(at + 8, boxEnd))) return "display-p3";
  }
  return "srgb";
}

/** Perfil ICC de P3: o nome aparece em ASCII (ICC v2) ou UTF-16 (ICC v4, o do iPhone). */
function isP3Profile(icc: Uint8Array) {
  const name = /Display P3|P3 D65|DCI-P3/;
  return name.test(new TextDecoder("latin1").decode(icc)) || name.test(new TextDecoder("utf-16be").decode(icc));
}

/** IMG_0001.HEIC → IMG_0001.jpg */
export function jpegName(name: string) {
  if (/\.jpe?g$/i.test(name)) return name;
  return `${name.replace(/\.hei[cf]$/i, "")}.jpg`;
}
