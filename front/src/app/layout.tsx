import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { site } from "@/lib/site";
import "./globals.css";

// Uma família, duas vozes: larga e pesada nos títulos, normal no texto (eixo de largura variável).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Revelação de fotos online em Joinville | Fotoville", template: "%s | Fotoville" },
  description: site.description,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: site.name,
    title: "Revelação de fotos online em Joinville | Fotoville",
    description: site.description,
    images: [{ url: "/hero-fotos.jpg", width: 1024, height: 671, alt: "Fotos reveladas pela Fotoville" }],
  },
};

export const viewport: Viewport = { themeColor: "#f3f5f7", colorScheme: "light" };

// O cabeçalho mostra login e carrinho de quem está navegando: nada aqui pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:shadow-lift"
        >
          Pular para o conteúdo
        </a>
        <Header />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
