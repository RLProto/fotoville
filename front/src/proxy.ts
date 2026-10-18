import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/carrinho", "/checkout", "/pedido", "/conta", "/admin"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Renova o token da sessão; não coloque lógica entre createServerClient e getClaims.
  // getClaims confere a assinatura do token aqui mesmo (chave ES256 publicada pelo projeto), sem ir ao
  // servidor do Auth a cada requisição; só vai lá para renovar o token vencido. Páginas e rotas que
  // precisam do usuário continuam conferindo com getUser.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname, search } = request.nextUrl;
  // A escolha do tamanho (/enviar) é pública; o envio em si (/enviar/<tamanho>) pede login.
  const isProtected = pathname.startsWith("/enviar/") || PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!user && isProtected) {
    const login = request.nextUrl.clone();
    // Quem chega ao envio sem conta quase sempre é cliente novo: cadastro primeiro, com o link "Entrar" ao lado
    login.pathname = pathname.startsWith("/enviar/") ? "/cadastro" : "/entrar";
    login.search = `?proximo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  // As rotas de API passam por aqui: é o proxy que renova o token vencido antes de a rota rodar
  matcher: ["/((?!_next/static|_next/image|api/webhooks|robots\\.txt$|sitemap\\.xml$|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
