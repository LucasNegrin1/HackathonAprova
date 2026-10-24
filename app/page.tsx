"use client";
/* eslint-disable @next/next/no-img-element -- imagens são data URLs do anexo local */

import Link from "next/link";
import { useRef, useState } from "react";

type Perfil = "municipe" | "analista_prefeitura";

interface Bolha {
  de: "usuario" | "agente";
  texto: string;
  imagem?: string;
}

interface Estado {
  id: string;
  status: "em_atendimento" | "resolvida_autoatendimento" | "ticket_aberto";
  categoria: string | null;
  campos: { id: string; rotulo: string; valor: string | null; coletadoPeloAgente: boolean }[];
  completo: boolean;
  artigosSugeridos: string[];
  artigoQueResolveu: string | null;
  ticketId: string | null;
  modo: "ia" | "demo";
}

type Imagem = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; url: string };

const EXEMPLOS: Record<Perfil, string[]> = {
  municipe: [
    "Paguei a taxa do alvará faz 5 dias e o processo continua aguardando pagamento",
    "Não consigo anexar a planta do meu projeto, dá erro",
    "Esqueci minha senha",
  ],
  analista_prefeitura: [
    "Sou da prefeitura de Campinas. A tela de análise de processos dá erro 500 desde ontem e a equipe toda está parada",
    "Preciso incluir um campo novo no formulário do alvará de construção",
    "O relatório de processos exportado vem vazio",
  ],
};

/** Renderiza o *negrito* do WhatsApp. */
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? <strong key={i}>{parte.slice(1, -1)}</strong> : <span key={i}>{parte}</span>,
      )}
    </>
  );
}

export default function Simulador() {
  const [perfil, setPerfil] = useState<Perfil>("municipe");
  const [bolhas, setBolhas] = useState<Bolha[]>([]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const rolar = () => setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth" }), 50);

  function reiniciar(novoPerfil = perfil) {
    setPerfil(novoPerfil);
    setBolhas([]);
    setEstado(null);
    setTexto("");
    setImagem(null);
  }

  async function enviar(mensagem = texto) {
    if ((!mensagem.trim() && !imagem) || digitando) return;
    const encerrada = estado && estado.status !== "em_atendimento";
    setBolhas((b) => [...(encerrada ? [] : b), { de: "usuario", texto: mensagem, imagem: imagem?.url }]);
    if (encerrada) setEstado(null);
    setTexto("");
    const anexo = imagem;
    setImagem(null);
    setDigitando(true);
    rolar();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId: encerrada ? undefined : estado?.id,
          perfil,
          texto: mensagem,
          imagem: anexo ? { base64: anexo.base64, mediaType: anexo.mediaType } : undefined,
        }),
      });
      const dados = (await r.json()) as { respostas: string[]; estado: Estado };
      setBolhas((b) => [...b, ...dados.respostas.map((t) => ({ de: "agente" as const, texto: t }))]);
      setEstado(dados.estado);
    } catch {
      setBolhas((b) => [...b, { de: "agente", texto: "Falha de conexão com o servidor." }]);
    } finally {
      setDigitando(false);
      rolar();
    }
  }

  function anexar(f: File | undefined) {
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const url = String(leitor.result);
      setImagem({ url, base64: url.split(",")[1], mediaType: f.type as Imagem["mediaType"] });
    };
    leitor.readAsDataURL(f);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[420px_1fr]">
      {/* Telefone */}
      <section>
        <div className="mb-3 flex gap-2">
          {(["municipe", "analista_prefeitura"] as const).map((p) => (
            <button
              key={p}
              onClick={() => reiniciar(p)}
              className={`rounded-full px-3 py-1 text-sm ${perfil === p ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
            >
              {p === "municipe" ? "Munícipe" : "Analista da prefeitura"}
            </button>
          ))}
          <button onClick={() => reiniciar()} className="ml-auto text-sm text-slate-500 hover:text-slate-900">
            Nova conversa
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border-8 border-slate-900 bg-white shadow-xl">
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 font-semibold text-[#075e54]">A</div>
            <div>
              <div className="text-sm font-semibold">Suporte Aprova</div>
              <div className="text-xs text-emerald-100">{digitando ? "digitando…" : "online"}</div>
            </div>
          </div>

          <div className="wa-fundo flex h-[520px] flex-col gap-2 overflow-y-auto p-3">
            {bolhas.length === 0 && (
              <div className="mx-auto mt-4 max-w-[85%] rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-xs text-slate-700">
                Escreva como {perfil === "municipe" ? "um munícipe" : "um analista da prefeitura"} ou use um exemplo abaixo.
              </div>
            )}
            {bolhas.map((b, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${
                  b.de === "usuario" ? "self-end bg-[#d9fdd3]" : "self-start bg-white"
                }`}
              >
                {b.imagem && <img src={b.imagem} alt="anexo" className="mb-1 max-h-40 rounded" />}
                <Texto texto={b.texto} />
              </div>
            ))}
            {digitando && <div className="self-start rounded-lg bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">…</div>}
            <div ref={fim} />
          </div>

          {imagem && (
            <div className="flex items-center gap-2 border-t bg-slate-50 px-3 py-2 text-xs">
              <img src={imagem.url} alt="" className="h-10 w-10 rounded object-cover" />
              Imagem pronta para enviar
              <button onClick={() => setImagem(null)} className="ml-auto text-slate-500">
                remover
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2 bg-[#f0f2f5] p-2"
          >
            <button type="button" onClick={() => arquivo.current?.click()} className="px-2 text-xl text-slate-500" title="Anexar print">
              +
            </button>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => anexar(e.target.files?.[0])} />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Mensagem"
              className="flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none"
            />
            <button type="submit" disabled={digitando} className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {EXEMPLOS[perfil].map((ex) => (
            <button key={ex} onClick={() => enviar(ex)} className="rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400">
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Bastidores */}
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Bastidores do atendimento</h1>
          <p className="text-sm text-slate-600">
            O agente conversa. As regras (checklist, prioridade e prazo) estão em código e decidem se o chamado pode ser aberto.
          </p>
          {estado?.modo === "demo" && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Modo demonstração: sem ANTHROPIC_API_KEY, um roteiro fixo usa as mesmas ferramentas do agente.
            </p>
          )}
        </div>

        <Resultado estado={estado} />

        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold">1. Base de conhecimento</h2>
          <p className="mt-1 text-sm text-slate-600">
            {estado?.artigosSugeridos.length ? `Artigos sugeridos: ${estado.artigosSugeridos.join(", ")}` : "Nenhuma busca ainda."}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">2. Checklist do chamado</h2>
            <span className="text-xs text-slate-500">{estado?.categoria ?? "categoria ainda não definida"}</span>
          </div>
          {estado?.campos.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {estado.campos.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2 text-sm">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      c.valor ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {c.valor ? "✓" : "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.rotulo}</div>
                    <div className="truncate text-slate-600">{c.valor ?? "pendente"}</div>
                  </div>
                  {c.valor && (
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${c.coletadoPeloAgente ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {c.coletadoPeloAgente ? "complemento evitado" : "veio no relato"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Aparece quando o agente classificar o chamado.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Resultado({ estado }: { estado: Estado | null }) {
  if (estado?.status === "resolvida_autoatendimento") {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <strong>Resolvido sem abrir ticket</strong> com o artigo {estado.artigoQueResolveu}. Um chamado a menos na fila.
      </div>
    );
  }
  if (estado?.status === "ticket_aberto") {
    return (
      <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
        <strong>Ticket {estado.ticketId} aberto completo.</strong>{" "}
        <Link href="/painel" className="underline">
          Ver no painel do suporte
        </Link>
      </div>
    );
  }
  return null;
}
