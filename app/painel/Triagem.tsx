"use client";

import { useCallback, useEffect, useState } from "react";

interface Parecido { id: string; protocolo: string; titulo: string; conta: string; prioridade: string | null; volume_grupo: number }
interface Aguardando {
  id: string; protocolo: string; tipo: string | null; categoria: string | null; criado_em: string; titulo: string; descricao: string | null; canal: string; requerente: string | null;
  impacto_informado: string | null; impacto_sugerido: number | null; urgencia_sugerida: number | null; motivo_sugestao: string | null;
  campos: Record<string, string>; conta_id: string; contas: { nome: string } | null; parecidos: Parecido[];
}
interface ItemFila {
  posicao: number; id: string; protocolo: string; prioridade: string; titulo: string; status: string; responsavel: string | null;
  conta: string; impacto_efetivo: number; urgencia: number; volume_grupo: number; prazo_informado: string | null;
  escalado: boolean; dias_sem_movimentacao: number; justificativa_p1: string | null; motivo_ajuste: string | null;
}
interface Cota { conta_id: string; conta: string; cota_p1: number; p1_abertos: number; cota_esgotada: boolean }
interface Visao {
  configurado: boolean; erro?: string;
  aguardando?: Aguardando[]; fila?: ItemFila[]; cota?: Cota[];
  parados?: { id: string; protocolo: string }[]; backlog?: { id: string; protocolo: string; tipo: string; titulo: string; conta: string }[];
}
interface Resposta { ok?: boolean; erro?: string; detalhe?: string; dica?: string; cota?: boolean; data?: unknown }

// Prévia da matriz do banco (matriz_prioridade). Quem calcula de verdade é o trigger.
const MATRIZ: Record<number, string> = { 9: "P1", 6: "P2", 4: "P3", 3: "P3", 2: "P4", 1: "P4" };
const COR: Record<string, string> = {
  P1: "bg-red-100 text-red-800", P2: "bg-orange-100 text-orange-800", P3: "bg-amber-50 text-amber-800", P4: "bg-slate-100 text-slate-700",
};
const ROTULO_ESCALA = ["", "1 baixo", "2 médio", "3 alto"];

async function acao(corpo: object): Promise<Resposta> {
  const r = await fetch("/api/triagem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  return r.json();
}

export default function Triagem() {
  const [visao, setVisao] = useState<Visao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(5);

  const carregar = useCallback(async () => {
    setVisao(await (await fetch("/api/triagem", { cache: "no-store" })).json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial e atualização periódica
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  if (!visao) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (!visao.configurado) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
        Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.
      </p>
    );
  }
  if (visao.erro) return <p className="text-sm text-red-700">{visao.erro}</p>;

  const executar = async (corpo: object, sucesso: string) => {
    const r = await acao(corpo);
    setAviso(r.ok ? sucesso : `${r.erro}${r.detalhe ? `: ${r.detalhe}` : ""}`);
    await carregar();
    return r;
  };

  return (
    <div className="space-y-6">
      {aviso && (
        <div className="flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
          {aviso}
          <button onClick={() => setAviso(null)} className="ml-auto text-slate-300">fechar</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Aguardando triagem" valor={visao.aguardando!.length} />
        <Indicador titulo="Na fila de atendimento" valor={visao.fila!.length} />
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <div className="text-xs text-slate-500">Parados há mais de 10 dias</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{visao.parados!.length}</div>
          <button
            onClick={async () => {
              const r = await acao({ acao: "escalar" });
              setAviso(r.ok ? `${r.data} chamado(s) escalado(s)` : r.erro ?? "erro");
              carregar();
            }}
            className="mt-2 text-xs text-sky-700 underline"
          >
            Escalar parados agora
          </button>
        </div>
        <Indicador titulo="Backlog de produto" valor={visao.backlog!.length} />
      </div>

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold">Cota de P1 por conta</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {visao.cota!.map((c) => (
            <span key={c.conta_id} className={`rounded-md px-2 py-1 text-xs ring-1 ${c.cota_esgotada ? "bg-red-50 text-red-800 ring-red-200" : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
              {c.conta}: {c.p1_abertos}/{c.cota_p1} P1
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Aguardando triagem ({visao.aguardando!.length})</h2>
        {visao.aguardando!.length === 0 && <p className="text-sm text-slate-500">Nenhum chamado novo. Abra um pelo simulador.</p>}
        {visao.aguardando!.slice(0, mostrar).map((c) => (
          <CartaoTriagem key={c.id} chamado={c} fila={visao.fila!} executar={executar} />
        ))}
        {visao.aguardando!.length > mostrar && (
          <button onClick={() => setMostrar((m) => m + 10)} className="text-sm text-sky-700 underline">
            Mostrar mais ({visao.aguardando!.length - mostrar} restantes)
          </button>
        )}
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Fila de atendimento, ordenada por prioridade</h2>
        {visao.fila!.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Fila vazia.</p>}
        <ul className="divide-y divide-slate-100">
          {visao.fila!.map((f) => (
            <LinhaFila key={f.id} item={f} executar={executar} />
          ))}
        </ul>
      </section>

      {visao.backlog!.length > 0 && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold">Backlog de produto (fora da fila de suporte)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {visao.backlog!.map((b) => (
              <li key={b.id}>
                <span className="font-mono text-xs text-slate-500">{b.protocolo}</span> · {b.tipo} · {b.conta} · {b.titulo}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

type Executar = (corpo: object, sucesso: string) => Promise<Resposta>;

function Escala({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className={`rounded px-2 py-1 text-xs ring-1 ${valor === n ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"}`}>
            {ROTULO_ESCALA[n]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CartaoTriagem({ chamado: c, fila, executar }: { chamado: Aguardando; fila: ItemFila[]; executar: Executar }) {
  const [tipo, setTipo] = useState(c.tipo ?? "problema");
  const [impacto, setImpacto] = useState(c.impacto_sugerido ?? 2);
  const [urgencia, setUrgencia] = useState(c.urgencia_sugerida ?? 2);
  const [pai, setPai] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [cotaExcedida, setCotaExcedida] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const previa = MATRIZ[impacto * urgencia];
  const p1DaConta = fila.filter((f) => f.prioridade === "P1" && f.conta === c.contas?.nome);
  const vaiParaBacklog = tipo === "sugestao" || tipo === "parametrizacao";

  async function triar() {
    const r = await executar(
      { acao: "triar", id: c.id, tipo, impacto, urgencia, pai: pai || undefined, justificativa: justificativa || undefined },
      vaiParaBacklog ? `${c.protocolo} enviado ao backlog de produto` : pai ? `${c.protocolo} vinculado` : `${c.protocolo} entrou na fila`,
    );
    setCotaExcedida(r.cota ? r.detalhe ?? "Cota de P1 excedida" : null);
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline gap-2 text-sm">
        <span className="font-mono text-xs text-slate-500">{c.protocolo}</span>
        <span className="font-medium">{c.titulo}</span>
        <span className="text-xs text-slate-500">
          · {c.contas?.nome} · {c.canal}
          {c.categoria && ` · ${c.categoria}`} · aberto em {new Date(c.criado_em).toLocaleDateString("pt-BR")}
        </span>
      </div>
      {c.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-700">{c.descricao}</p>}
      <details className="mt-1 text-xs text-slate-600">
        <summary className="cursor-pointer">Dados do chamado</summary>
        <ul className="mt-1 space-y-0.5">
          {Object.entries(c.campos).map(([k, v]) => (
            <li key={k}><span className="text-slate-400">{k.replaceAll("_", " ")}:</span> {v}</li>
          ))}
        </ul>
      </details>
      {c.impacto_informado && <p className="mt-1 text-xs text-slate-600">Impacto informado pelo cliente: “{c.impacto_informado}”</p>}

      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[auto_1fr]">
        <div>
          <div className="text-xs text-slate-500">Tipo</div>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="problema">Problema</option>
            <option value="duvida">Dúvida</option>
            <option value="ajuste">Ajuste</option>
            <option value="sugestao">Sugestão → backlog</option>
            <option value="parametrizacao">Nova parametrização → backlog</option>
          </select>
        </div>

        {!vaiParaBacklog && c.parecidos.length > 0 && (
          <div>
            <div className="text-xs text-slate-500">Parecido com um chamado aberto?</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input type="radio" checked={pai === ""} onChange={() => setPai("")} /> Não, é novo
              </label>
              {c.parecidos.map((p) => (
                <label key={p.id} className="flex items-center gap-1">
                  <input type="radio" checked={pai === p.id} onChange={() => setPai(p.id)} />
                  Vincular a {p.protocolo} ({p.prioridade ?? "—"}, {p.volume_grupo} vinculados): {p.titulo.slice(0, 50)}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {!vaiParaBacklog && !pai && (
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <Escala rotulo="Impacto" valor={impacto} onChange={setImpacto} />
          <Escala rotulo="Urgência" valor={urgencia} onChange={setUrgencia} />
          <div className="text-sm">
            Prévia: <span className={`rounded px-1.5 py-0.5 text-xs ${COR[previa]}`}>{previa}</span>
            {c.motivo_sugestao && <span className="ml-2 text-xs text-slate-500">sugestão do agente: {c.motivo_sugestao}</span>}
          </div>
        </div>
      )}

      {cotaExcedida && (
        <div className="mt-3 space-y-2 rounded-md bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
          <p><strong>Conta acima da cota de P1.</strong> {cotaExcedida} Rebaixe outro P1 ou registre a justificativa.</p>
          {p1DaConta.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono">{p.protocolo}</span> {p.titulo.slice(0, 60)}
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="motivo do rebaixamento" className="rounded border border-red-200 bg-white px-2 py-1" />
              <button
                disabled={!motivo.trim()}
                onClick={async () => {
                  await executar({ acao: "rebaixar", id: p.id, motivo }, `${p.protocolo} rebaixado para P2`);
                  setMotivo("");
                  setCotaExcedida(null);
                }}
                className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-50"
              >
                Rebaixar para P2
              </button>
            </div>
          ))}
          <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ou justifique este P1 acima da cota" className="w-full rounded border border-red-200 bg-white px-2 py-1 text-xs" />
        </div>
      )}

      <button onClick={triar} className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
        {vaiParaBacklog ? "Enviar ao backlog" : pai ? "Vincular ao chamado-pai" : "Colocar na fila"}
      </button>
    </div>
  );
}

function LinhaFila({ item: f, executar }: { item: ItemFila; executar: Executar }) {
  const [resolvendo, setResolvendo] = useState(false);
  const [solucao, setSolucao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [rebaixando, setRebaixando] = useState(false);

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-right text-xs text-slate-400">{f.posicao}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs ${COR[f.prioridade]}`}>{f.prioridade}</span>
        <span className="font-mono text-xs text-slate-500">{f.protocolo}</span>
        <span className="min-w-0 flex-1 truncate">{f.titulo}</span>
        <span className="text-xs text-slate-500">{f.conta}</span>
        {f.volume_grupo > 0 && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">+{f.volume_grupo} vinculados</span>}
        {f.escalado && <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">escalado</span>}
        <span className="text-xs text-slate-400">{f.dias_sem_movimentacao}d parado</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 pl-8 text-xs text-slate-500">
        <span>impacto {f.impacto_efetivo} × urgência {f.urgencia}</span>
        <span>{f.status === "em_atendimento" ? `em atendimento: ${f.responsavel}` : f.status.replaceAll("_", " ")}</span>
        {f.justificativa_p1 && <span>P1 justificado: {f.justificativa_p1}</span>}
        {f.motivo_ajuste && <span>rebaixado: {f.motivo_ajuste}</span>}
        {f.status === "na_fila" && (
          <button onClick={() => executar({ acao: "atender", id: f.id, responsavel: "Analista de suporte" }, `${f.protocolo} em atendimento`)} className="text-sky-700 underline">
            Atender
          </button>
        )}
        {f.prioridade === "P1" && (
          <button onClick={() => setRebaixando((v) => !v)} className="text-sky-700 underline">Rebaixar</button>
        )}
        <button onClick={() => setResolvendo((v) => !v)} className="text-emerald-700 underline">Resolver</button>
      </div>
      {rebaixando && (
        <div className="mt-2 flex gap-2 pl-8">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="motivo do rebaixamento" className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
          <button disabled={!motivo.trim()} onClick={() => executar({ acao: "rebaixar", id: f.id, motivo }, `${f.protocolo} rebaixado para P2`)} className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50">
            Rebaixar para P2
          </button>
        </div>
      )}
      {resolvendo && (
        <div className="mt-2 flex gap-2 pl-8">
          <input value={solucao} onChange={(e) => setSolucao(e.target.value)} placeholder="solução aplicada" className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
          <button
            disabled={!solucao.trim()}
            onClick={() => executar({ acao: "resolver", id: f.id, solucao }, `${f.protocolo} resolvido${f.volume_grupo ? ` com ${f.volume_grupo} vinculados em lote` : ""}`)}
            className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Resolver{f.volume_grupo ? ` e fechar ${f.volume_grupo} vinculados` : ""}
          </button>
        </div>
      )}
    </li>
  );
}
