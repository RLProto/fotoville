import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Só vale em `npm run dev`: libera abrir o site por outros aparelhos da rede local
  // (ex.: http://192.168.0.26:3000 no celular). Sem isso a página abre, mas os botões não funcionam.
  allowedDevOrigins: ["192.168.0.26", "192.168.0.*"],
  // Esconde o selo "N" do Next no canto da tela durante `npm run dev`
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    // Endereços do site antigo que podem estar em buscadores e favoritos
    return [
      { source: "/catalog", destination: "/precos", permanent: true },
      { source: "/catalog/15", destination: "/precos", permanent: true },
      { source: "/catalog/36", destination: "/promocoes", permanent: true },
      { source: "/catalog/product/:id", destination: "/enviar", permanent: true },
      // Antigo catálogo deste site: virou a escolha do tamanho, primeiro passo do pedido
      { source: "/revelacao", destination: "/enviar", permanent: true },
      { source: "/user/login", destination: "/entrar", permanent: true },
      { source: "/user/register", destination: "/cadastro", permanent: true },
      { source: "/account", destination: "/conta", permanent: true },
      { source: "/site/termosdeuso", destination: "/termos-de-uso", permanent: true },
      { source: "/site/politicadeprivacidade", destination: "/politica-de-privacidade", permanent: true },
      { source: "/info/page/prazos-e-frete", destination: "/prazos-e-frete", permanent: true },
      { source: "/info/page/quem-somos", destination: "/quem-somos", permanent: true },
      { source: "/info/page/termos-de-uso", destination: "/termos-de-uso", permanent: true },
      { source: "/info/page/politica-de-privacidade", destination: "/politica-de-privacidade", permanent: true },
    ];
  },
};

export default nextConfig;
