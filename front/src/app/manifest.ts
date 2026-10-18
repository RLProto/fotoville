import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Nome e ícone de quem salva o site na tela inicial do celular. Abre no navegador, como o site. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: "pt-BR",
    start_url: "/",
    display: "browser",
    background_color: "#f3f5f7",
    theme_color: "#f3f5f7",
    icons: [{ src: "/logo-icon.png", sizes: "512x512", type: "image/png" }],
  };
}
