import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="display text-4xl sm:text-5xl">Página não encontrada</h1>
      <p className="mt-3 text-lg text-ink-2">Esta página não existe.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Voltar ao início
        </Link>
        <Link href="/enviar" className="btn btn-outline">
          Ver tamanhos e preços
        </Link>
      </div>
    </div>
  );
}
