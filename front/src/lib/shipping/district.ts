/** Chave de comparação de bairro ou cidade: sem acento, minúsculo, espaços simples. Vale no servidor e no navegador. */
export function districtKey(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
