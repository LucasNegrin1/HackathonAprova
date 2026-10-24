"use client";
/* eslint-disable @next/next/no-img-element -- imagens são data URLs do anexo local */

import { useEffect, useRef, useState } from "react";

// Chat do site. Roda dentro de um iframe aberto pelo /widget.js, mas também funciona acessado direto.
// Não pede identificação para conversar: o bot responde primeiro e só pede nome e e-mail se for abrir chamado.

type Imagem = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; url: string };
interface Bolha { de: "usuario" | "agente"; texto: string; imagem?: string }
interface Estado { id: string; status: string; ticketId: string | null }

const BOAS_VINDAS: Bolha = {
  de: "agente",
  texto: "Olá! Sou o atendimento da plataforma Aprova. Me conte sua dúvida ou o que está acontecendo. Se tiver um print da tela, pode anexar no clipe.",
};

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? <strong key={i}>{parte.slice(1, -1)}</strong> : <span key={i}>{parte}</span>,
      )}
    </>
  );
}

function fechar() {
  window.parent?.postMessage({ tipo: "aprova-widget-fechar" }, "*");
}

export default function Widget() {
  const [conta, setConta] = useState<string | undefined>();
  const [bolhas, setBolhas] = useState<Bolha[]>([BOAS_VINDAS]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<string[]>([]);
  const fim = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // O site que instala o widget pode fixar a conta (data-conta no script).
    setConta(new URLSearchParams(window.location.search).get("conta") ?? undefined);
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [bolhas, digitando]);

  const encerrado = estado !== null && estado.status !== "em_atendimento";

  function novoAtendimento() {
    setEstado(null);
    setOpcoes([]);
    setBolhas([{ de: "agente", texto: "Pode me contar a nova dúvida ou problema." }]);
  }

  async function enviar(mensagem = texto) {
    if ((!mensagem.trim() && !imagem) || digitando) return;
    const anexo = imagem;
    setBolhas((b) => [...b, { de: "usuario", texto: mensagem, imagem: anexo?.url }]);
    setTexto("");
    setImagem(null);
    setErro(null);
    setOpcoes([]);
    setDigitando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId: encerrado ? undefined : estado?.id,
          texto: mensagem,
          imagem: anexo ? { base64: anexo.base64, mediaType: anexo.mediaType } : undefined,
          site: { conta },
        }),
      });
      const dados = (await r.json()) as { respostas?: string[]; opcoes?: string[]; estado?: Estado; erro?: string };
      if (!r.ok || !dados.respostas) throw new Error(dados.erro);
      setBolhas((b) => [...b, ...dados.respostas!.map((t) => ({ de: "agente" as const, texto: t }))]);
      setEstado(dados.estado!);
      setOpcoes(dados.opcoes ?? []);
      // Avisa a página onde o chat está (o painel PrefTech) para mostrar o ticket na hora.
      if (dados.estado?.ticketId && dados.estado.ticketId !== estado?.ticketId) {
        window.parent?.postMessage({ tipo: "aprova-ticket-criado", protocolo: dados.estado.ticketId }, "*");
      }
    } catch (e) {
      setBolhas((b) => [...b, { de: "agente", texto: (e as Error).message || "Não consegui falar com o servidor. Tente de novo em instantes." }]);
    } finally {
      setDigitando(false);
    }
  }

  function anexar(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErro("A imagem precisa ter até 5 MB.");
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      const url = String(leitor.result);
      setImagem({ url, base64: url.split(",")[1], mediaType: f.type as Imagem["mediaType"] });
    };
    leitor.readAsDataURL(f);
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-slate-900">
      <header className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">A</div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Atendimento Aprova</div>
          <div className="text-xs text-emerald-100">{digitando ? "digitando…" : conta ? conta : "Respondemos na hora"}</div>
        </div>
        <button onClick={fechar} aria-label="Fechar" className="rounded px-2 text-lg leading-none text-emerald-100 hover:text-white">
          ×
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-slate-50 p-3">
        {bolhas.map((b, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${b.de === "usuario" ? "self-end bg-emerald-700 text-white" : "self-start bg-white shadow-sm ring-1 ring-slate-200"}`}>
            {b.imagem && <img src={b.imagem} alt="anexo" className="mb-1 max-h-40 rounded" />}
            <Texto texto={b.texto} />
          </div>
        ))}
        {digitando && <div className="self-start rounded-2xl bg-white px-3 py-2 text-sm text-slate-400 ring-1 ring-slate-200">…</div>}
        {encerrado && (
          <div className="mt-2 rounded-xl bg-white p-3 text-center text-sm ring-1 ring-slate-200">
            {estado?.ticketId ? (
              <>
                <div className="text-xs text-slate-500">Protocolo do seu chamado</div>
                <div className="font-mono text-lg font-semibold">{estado.ticketId}</div>
                <div className="mt-1 text-xs text-slate-500">O retorno chega no e-mail informado.</div>
              </>
            ) : (
              <div className="text-emerald-800">Resolvido sem precisar abrir chamado.</div>
            )}
            <button onClick={novoAtendimento} className="mt-2 text-xs text-emerald-700 underline">
              Novo atendimento
            </button>
          </div>
        )}
        <div ref={fim} />
      </div>

      {/* Respostas rápidas sugeridas pelo fluxo (perfil, "resolveu?", confirmação). */}
      {!encerrado && opcoes.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 pt-2">
          {opcoes.map((r) => (
            <button key={r} onClick={() => enviar(r)} disabled={digitando} className="rounded-full px-3 py-1 text-sm text-emerald-800 ring-1 ring-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
              {r}
            </button>
          ))}
        </div>
      )}
      {imagem && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs">
          <img src={imagem.url} alt="" className="h-10 w-10 rounded object-cover" /> Imagem pronta para enviar
          <button onClick={() => setImagem(null)} className="ml-auto text-slate-500">remover</button>
        </div>
      )}
      {erro && <p className="px-3 pt-1 text-xs text-red-700">{erro}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex items-center gap-2 border-t border-slate-200 p-2"
      >
        <button type="button" onClick={() => arquivo.current?.click()} aria-label="Anexar imagem" className="px-2 text-lg text-slate-500" disabled={encerrado}>
          📎
        </button>
        <input ref={arquivo} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => anexar(e.target.files?.[0])} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={encerrado ? "Atendimento encerrado" : "Escreva sua mensagem"}
          disabled={encerrado}
          autoFocus
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-emerald-600"
        />
        <button type="submit" disabled={digitando || encerrado} className="rounded-full bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">
          Enviar
        </button>
      </form>
      <p className="pb-2 text-center text-[11px] text-slate-400">Nunca envie senhas por aqui.</p>
    </div>
  );
}
