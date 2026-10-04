/** Cabeçalho das páginas internas: o título fala por si, sem rótulo acima. */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-rule">
      <div className="container-page pt-12 pb-10 sm:pt-16">
        <h1 className="display max-w-[22ch] text-[2.1rem] sm:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-[62ch] text-lg text-ink-2">{children}</div>}
      </div>
    </div>
  );
}
