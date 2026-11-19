/**
 * Arquivo .zip montado no navegador, sem compressão (as fotos já são JPG). Cada arquivo entra como
 * referência ao Blob, sem cópia: o .zip final é um Blob feito de pedaços. Sem ZIP64, então cada .zip
 * precisa ficar abaixo de 4 GB e de 65535 arquivos; quem usa divide em partes antes disso.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

async function crc32(blob: Blob) {
  let crc = 0xffffffff;
  // Em pedaços, para não segurar o arquivo inteiro como ArrayBuffer
  const chunk = 8 * 1024 * 1024;
  for (let at = 0; at < blob.size; at += chunk) {
    const bytes = new Uint8Array(await blob.slice(at, at + chunk).arrayBuffer());
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Data e hora no formato do MS-DOS, usado pelo zip. */
function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

type Entry = { name: Uint8Array<ArrayBuffer>; blob: Blob; crc: number; offset: number };

export class ZipBuilder {
  private parts: BlobPart[] = [];
  private entries: Entry[] = [];
  private offset = 0;
  private crcs = new WeakMap<Blob, Promise<number>>();
  private stamp = dosDateTime(new Date());

  /** Bytes já incluídos (aproximado do tamanho final). */
  get size() {
    return this.offset;
  }

  get count() {
    return this.entries.length;
  }

  /** Acrescenta um arquivo. O mesmo Blob pode entrar várias vezes (cópias) sem recalcular o CRC. */
  async add(path: string, blob: Blob) {
    const crc = await (this.crcs.get(blob) ?? this.crcs.set(blob, crc32(blob)).get(blob)!);
    const name = new TextEncoder().encode(path);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // versão necessária
    header.setUint16(6, 0x0800, true); // nomes em UTF-8
    header.setUint16(8, 0, true); // sem compressão
    header.setUint16(10, this.stamp.time, true);
    header.setUint16(12, this.stamp.day, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, blob.size, true);
    header.setUint32(22, blob.size, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    this.entries.push({ name, blob, crc, offset: this.offset });
    this.parts.push(header.buffer, name, blob);
    this.offset += 30 + name.length + blob.size;
  }

  /** Fecha o .zip com o diretório central. */
  finish(): Blob {
    const central: BlobPart[] = [];
    let centralSize = 0;
    for (const e of this.entries) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);
      h.setUint16(4, 20, true); // feito por
      h.setUint16(6, 20, true); // versão necessária
      h.setUint16(8, 0x0800, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, this.stamp.time, true);
      h.setUint16(14, this.stamp.day, true);
      h.setUint32(16, e.crc, true);
      h.setUint32(20, e.blob.size, true);
      h.setUint32(24, e.blob.size, true);
      h.setUint16(28, e.name.length, true);
      // extra, comentário, disco, atributos internos: zero
      h.setUint32(38, 0, true); // atributos externos
      h.setUint32(42, e.offset, true);
      central.push(h.buffer, e.name);
      centralSize += 46 + e.name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...central, end.buffer], { type: "application/zip" });
  }
}
