const BASE = "https://fotoville.invalid";

/**
 * Aceita só destinos deste site, para o redirecionamento pós-login não virar open redirect.
 * O navegador ignora tab e quebra de linha numa URL e lê "\" como "/": "/\t/site.com" vira "//site.com".
 * Por isso o destino é lido pelo mesmo parser de URL do navegador, e só passa se continuar neste site.
 */
export function safeNext(value: string | string[] | undefined, fallback = "/conta") {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/")) return fallback;
  try {
    const url = new URL(path, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
