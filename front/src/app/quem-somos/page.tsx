import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Quem somos",
  description: `A Fotoville revela fotos em ${site.address.city} desde ${site.since}, em papel Kodak e Fujifilm.`,
};

export default function QuemSomosPage() {
  return (
    <>
      <PageHeader title="Fotografia é para segurar na mão" />
      <div className="container-page grid items-center gap-12 py-12 lg:grid-cols-[1.3fr_1fr]">
        <div className="max-w-[52ch] space-y-4 text-xl">
          <p>
            Revelamos fotos em {site.address.city} desde {site.since}, em papel Kodak e Fujifilm.
          </p>
          <p className="text-ink-2">Você envia pelo site e recebe em casa, em qualquer lugar do Brasil.</p>
          <p className="pt-4">
            <Link href="/enviar" className="btn btn-accent btn-lg">
              Enviar fotos
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-center gap-8">
          <Image src="/logo-full.png" alt="Logo da Fotoville" width={260} height={241} />
          <Image src="/papeis-kodak-fuji.png" alt="Papéis Kodak e Fujifilm" width={298} height={63} />
        </div>
      </div>
    </>
  );
}
