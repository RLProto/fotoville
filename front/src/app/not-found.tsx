import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="display text-4xl sm:text-5xl">Página não encontrada</h1>
      <p className="mt-3 text-lg text-ink-2">O endereço pode ter mudado.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/enviar" className="btn btn-accent">
          Enviar fotos
        </Link>
        <Link href="/" className="btn btn-outline">
          Página inicial
        </Link>
      </div>
    </div>
  );
}
