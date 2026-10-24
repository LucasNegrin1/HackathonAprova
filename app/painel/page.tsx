"use client";

import { useCallback, useEffect, useState } from "react";
import type { Metricas } from "@/lib/metrics";
import type { MensagemTranscript, Ticket } from "@/lib/types";
import Triagem from "./Triagem";

type TicketComTranscript = Ticket & { transcript: MensagemTranscript[] };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const num = (v: number | null, casas = 1) => (v === null ? "—" : v.toFixed(casas).replace(".", ","));

const COR_PRIORIDADE: Record<string, string> = {
  urgente: "bg-red-100 text-red-800",
  alta: "bg-orange-100 text-orange-800",
  media: "bg-amber-50 text-amber-800",
  baixa: "bg-slate-100 text-slate-700",
};

export default function Painel() {
  const [tickets, setTickets] = useState<TicketComTranscript[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<"triagem" | "agente">("triagem");

  const carregar = useCallback(async () => {
    const r = await fetch("/api/tickets", { cache: "no-store" });
    const dados = (await r.json()) as { tickets: TicketComTranscript[]; metricas: Metricas };
    setTickets(dados.tickets);
    setMetricas(dados.metricas);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial e atualização periódica
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  async function avaliar(id: string, precisouComplemento: boolean) {
    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, precisouComplemento, status: precisouComplemento ? "em_analise" : "resolvido" }),
    });
    carregar();
  }

  async function zerar() {
    if (!confirm("Apagar todas as conversas e tickets da demonstração?")) return;
    await fetch("/api/tickets", { method: "DELETE" });
    setSelecionado(null);
    carregar();
  }

  const ticket = tickets.find((t) => t.id === selecionado);
  const b = metricas?.baseline;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Painel do suporte</h1>
          <p className="text-sm text-slate-600">Triagem com as regras do banco e indicadores do agente de abertura.</p>
        </div>
        <button onClick={zerar} className="text-sm text-slate-500 hover:text-red-700">
          Zerar demonstração
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([["triagem", "Triagem e fila"], ["agente", "Indicadores do agente"]] as const).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${aba === id ? "border-slate-900 font-medium" : "border-transparent text-slate-500"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "triagem" ? <Triagem /> : <>
      {metricas && b && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              titulo="Resolvidos sem ticket"
              valor={pct(metricas.taxaDeflexao)}
              detalhe={`${metricas.resolvidasSemTicket} de ${metricas.conversas} atendimentos encerrados`}
              antes={`antes: ${pct(1 - b.pctDuvidasQueViramTicket)} (toda dúvida vira ticket)`}
              objetivo="Menos tickets"
            />
            <Cartao
              titulo="Complementos evitados por ticket"
              valor={num(metricas.complementosEvitadosPorTicket)}
              detalhe={`${metricas.complementosEvitados} informações coletadas antes da abertura`}
              antes={`antes: ${num(b.complementosPorTicket)} pedidos de complemento por ticket`}
              objetivo="Abertura melhor"
            />
            <Cartao
              titulo="Completude na abertura"
              valor={pct(metricas.completudeMedia)}
              detalhe={`média do checklist em ${metricas.ticketsAbertos} tickets (“não sabe” conta como faltante)`}
              antes={`antes: ${pct(1 - b.pctTicketsComComplemento)} dos tickets chegavam completos`}
              objetivo="Abertura melhor"
            />
            <Cartao
              titulo="Resolvidos na 1ª análise"
              valor={pct(metricas.resolvidosPrimeiraAnalise)}
              detalhe={`avaliação do analista em ${metricas.avaliados} tickets`}
              antes={`antes: ${pct(b.pctResolvidosPrimeiraAnalise)}`}
              objetivo="Abertura melhor"
            />
          </div>
          {b.exemplo && <p className="text-xs text-amber-700">Linha “antes”: {b.fonte}</p>}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl bg-white ring-1 ring-slate-200">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Fila ({tickets.length})</h2>
          {tickets.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Nenhum ticket ainda. Abra um pelo simulador.</p>}
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelecionado(t.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${selecionado === t.id ? "bg-slate-50" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-500">{t.id}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${COR_PRIORIDADE[t.prioridade]}`}>{t.prioridade}</span>
                      <span className="text-xs text-slate-500">{t.canal === "whatsapp" ? "WhatsApp" : "Chat"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{t.resumo}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div>{pct(t.completude)} completo</div>
                    <div>
                      {t.precisouComplemento === null ? "não avaliado" : t.precisouComplemento ? "pediu complemento" : "resolvido de 1ª"}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          {!ticket ? (
            <p className="text-sm text-slate-500">Selecione um ticket para ver o que chegou para o analista.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs text-slate-500">{ticket.id}</div>
                <p className="mt-1 text-sm">{ticket.resumo}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Prioridade <strong>{ticket.prioridade}</strong> ({ticket.motivoPrioridade}) · prazo{" "}
                  {new Date(ticket.prazo).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                  {ticket.perfil === "municipe" ? "munícipe" : "analista da prefeitura"}
                </p>
              </div>

              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(ticket.campos).map(([id, valor]) => (
                    <tr key={id}>
                      <td className="py-1.5 pr-3 align-top text-slate-500">{id.replaceAll("_", " ")}</td>
                      <td className="py-1.5">
                        {valor}
                        {ticket.camposColetadosPeloAgente.includes(id) && (
                          <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">coletado pelo agente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => avaliar(ticket.id, false)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
                  Resolvi sem pedir complemento
                </button>
                <button onClick={() => avaliar(ticket.id, true)} className="rounded-md bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300">
                  Precisei pedir complemento
                </button>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600">Conversa original ({ticket.transcript.length} mensagens)</summary>
                <div className="mt-2 space-y-1.5">
                  {ticket.transcript.map((m, i) => (
                    <div key={i} className={`whitespace-pre-wrap rounded px-2 py-1 ${m.de === "usuario" ? "bg-[#d9fdd3]" : "bg-slate-50"}`}>
                      <span className="text-xs text-slate-500">{m.de === "usuario" ? "requerente" : "agente"}: </span>
                      {m.texto}
                      {m.imagem && <em className="text-slate-500"> [imagem]</em>}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </section>
      </div>
      </>}
    </div>
  );
}

function Cartao({ titulo, valor, detalhe, antes, objetivo }: { titulo: string; valor: string; detalhe: string; antes: string; objetivo: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-wide text-slate-500">{objetivo}</div>
      <div className="mt-1 text-sm font-medium">{titulo}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{valor}</div>
      <div className="mt-1 text-xs text-slate-600">{detalhe}</div>
      <div className="mt-2 text-xs text-slate-400">{antes}</div>
    </div>
  );
}
