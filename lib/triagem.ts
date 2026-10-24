import { normalizar } from "./catalogo";
import { supabase } from "./supabase";

// Leitura e ações da triagem do suporte. As regras (prioridade, cota de P1, volume, lote) estão no banco;
// aqui só chamamos as funções SQL e montamos a visão para o painel.

export interface ChamadoAberto {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  canal: string;
  perfil: string | null;
  requerente: string | null;
  impacto_informado: string | null;
  impacto_sugerido: number | null;
  urgencia_sugerida: number | null;
  motivo_sugestao: string | null;
  campos: Record<string, string>;
  criado_em: string;
  conta_id: string;
  contas: { nome: string } | null;
  parecidos: { id: string; protocolo: string; titulo: string; conta: string; prioridade: string | null; volume_grupo: number }[];
}

const STATUS_FILA = ["na_fila", "em_atendimento", "aguardando_cliente"];

const GENERICAS = new Set([
  "para", "como", "pois", "esta", "sobre", "mais", "quando", "onde", "isso", "esse", "essa", "favor", "obrigado", "obrigada",
  "processo", "processos", "sistema", "aprova", "prefeitura", "solicito", "solicitacao", "preciso", "gostaria", "estamos", "temos",
]);

function palavras(texto: string) {
  return new Set(normalizar(texto).split(" ").filter((p) => p.length > 3 && !GENERICAS.has(p)));
}

/**
 * "Parecido com um chamado aberto?": mesma categoria na fila e palavras relevantes em comum no título e no começo da descrição.
 * Só sugere: quem decide vincular é o analista.
 */
function sugerirParecidos(alvo: ChamadoAberto, abertos: (ChamadoAberto & { prioridade: string | null; volume_grupo: number })[]) {
  const titulo = palavras(alvo.titulo);
  const corpo = palavras((alvo.descricao ?? "").slice(0, 400));
  return abertos
    .filter((c) => c.categoria === alvo.categoria && c.id !== alvo.id)
    .map((c) => {
      const noTitulo = [...palavras(c.titulo)].filter((p) => titulo.has(p)).length;
      const noCorpo = [...palavras((c.descricao ?? "").slice(0, 400))].filter((p) => corpo.has(p)).length;
      // Título pesa o dobro; o começo da descrição confirma. Mesma conta desempata.
      return { c, noTitulo, pontos: 2 * noTitulo + noCorpo + (c.conta_id === alvo.conta_id ? 1 : 0) };
    })
    .filter((r) => r.noTitulo >= 1 && r.pontos >= 6)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 3)
    .map(({ c }) => ({ id: c.id, protocolo: c.protocolo, titulo: c.titulo, conta: c.contas?.nome ?? "", prioridade: c.prioridade, volume_grupo: c.volume_grupo }));
}

export async function visaoTriagem() {
  const db = supabase();
  const [aguardando, emFila, fila, cota, parados, backlog] = await Promise.all([
    db.from("chamados").select("*, contas(nome)").eq("status", "aberto").order("criado_em"),
    db.from("chamados").select("*, contas(nome)").in("status", STATUS_FILA).is("chamado_pai_id", null),
    db.from("fila_atendimento").select("*"),
    db.from("uso_cota_p1").select("*").order("conta"),
    db.from("chamados_parados").select("*"),
    db.from("backlog_produto").select("*"),
  ]);
  for (const r of [aguardando, emFila, fila, cota, parados, backlog]) if (r.error) throw r.error;

  const abertos = emFila.data!;
  return {
    aguardando: (aguardando.data as ChamadoAberto[]).map((c) => ({ ...c, parecidos: sugerirParecidos(c, abertos) })),
    fila: fila.data!,
    cota: cota.data!,
    parados: parados.data!,
    backlog: backlog.data!,
  };
}

export type AcaoTriagem =
  | { acao: "triar"; id: string; tipo: string; impacto?: number; urgencia?: number; pai?: string; justificativa?: string }
  | { acao: "rebaixar"; id: string; motivo: string; nova?: string }
  | { acao: "resolver"; id: string; solucao: string }
  | { acao: "atender"; id: string; responsavel: string }
  | { acao: "escalar" };

export async function executarAcao(a: AcaoTriagem, autor = "suporte (painel)") {
  const db = supabase();
  switch (a.acao) {
    case "triar":
      return db.rpc("triar_chamado", {
        p_id: a.id,
        p_tipo: a.tipo,
        p_impacto: a.impacto ?? null,
        p_urgencia: a.urgencia ?? null,
        p_chamado_pai: a.pai ?? null,
        p_justificativa_p1: a.justificativa?.trim() || null,
        p_autor: autor,
      });
    case "rebaixar":
      return db.rpc("rebaixar_p1", { p_id: a.id, p_motivo: a.motivo, p_nova: a.nova ?? "P2", p_autor: autor });
    case "resolver":
      return db.rpc("resolver_chamado", { p_id: a.id, p_solucao: a.solucao, p_autor: autor });
    case "atender":
      return db.from("chamados").update({ status: "em_atendimento", responsavel: a.responsavel }).eq("id", a.id);
    case "escalar":
      return db.rpc("escalar_parados", { p_autor: autor });
  }
}
