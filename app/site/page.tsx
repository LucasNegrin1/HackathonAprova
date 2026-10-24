import Script from "next/script";

// Página de exemplo de um portal de prefeitura (fictícia) com o widget instalado em uma linha.
export default function SiteExemplo() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-indigo-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-white/15 font-bold">V</div>
          <div>
            <div className="text-lg font-semibold">Prefeitura de Valfenda</div>
            <div className="text-xs text-indigo-200">Portal de licenciamento · site fictício de demonstração</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <section>
          <h1 className="text-3xl font-semibold text-slate-900">Aprovação de projetos e alvarás</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Abra processos de alvará de construção, habite-se e certidões pela internet. Dúvidas ou problemas? Use o atendimento no canto da tela.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {["Alvará de construção", "Habite-se", "Certidões"].map((s) => (
            <div key={s} className="rounded-lg border border-slate-200 p-4">
              <div className="font-medium text-slate-900">{s}</div>
              <div className="mt-1 text-sm text-slate-500">Solicitar, acompanhar e pagar taxas.</div>
            </div>
          ))}
        </section>
        <section className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-800">Como este widget foi instalado</div>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-emerald-200">
            {'<script src="https://SEU_HOST/widget.js" data-conta="Valfenda" async></script>'}
          </pre>
        </section>
      </main>
      <Script src="/widget.js" data-conta="Valfenda" strategy="afterInteractive" />
    </div>
  );
}
