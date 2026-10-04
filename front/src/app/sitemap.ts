import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const PATHS = [
  "",
  "/enviar",
  "/precos",
  "/promocoes",
  "/prazos-e-frete",
  "/quem-somos",
  "/contato",
  "/termos-de-uso",
  "/politica-de-privacidade",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: ["", "/precos", "/promocoes"].includes(path) ? "weekly" : "yearly",
    priority: path === "" ? 1 : 0.7,
  }));
}
