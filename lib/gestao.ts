import type { Priority, RequestType, TeamMember, Ticket, TicketStatus } from "@/app/(preftech)/data/mockSupportData";
import { MOCK_TEAM_MEMBERS } from "@/app/(preftech)/data/mockSupportData";
import { categoriaPorId } from "./catalogo";
import { supabase } from "./supabase";

// Dados reais do Supabase no formato do painel gerencial PrefTech (app/gestao).
// O painel continua com os tipos originais; só a origem dos dados mudou (antes: mockSupportData).

// SLA da próxima ação, contado da última movimentação do chamado.
export const SLA_HORAS: Record<Priority, number> = { P1: 4, P2: 8, P3: 24, P4: 72 };

const SEM_SLA = 1_000_000_000;

const STATUS: Record<string, TicketStatus> = {
  aberto: "Aberto",
  na_fila: "Aberto",
  em_atendimento: "Em Atendimento",
  aguardando_cliente: "Aguardando Cliente",
  vinculado: "Aberto",
  backlog_produto: "Aberto",
};

function tipoDeSolicitacao(tipo: string | null, prioridade: Priority): RequestType {
  if (tipo === "problema") return prioridade === "P1" ? "Incidente Crítico" : "Falha de Sistema";
  if (tipo === "duvida") return "Dúvida Operacional";
  return "Requisição";
}

interface Linha {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  canal: string;
  tipo: string | null;
  status: string;
  prioridade: Priority | null;
  impacto_efetivo: number | null;
  urgencia: number | null;
  responsavel: string | null;
  volume_grupo: number;
  justificativa_p1: string | null;
  motivo_ajuste: string | null;
  escalado_em: string | null;
  criado_em: string;
  ultima_movimentacao_em: string;
  contas: { nome: string } | null;
  pai: { protocolo: string } | null;
}

function paraTicket(c: Linha, agora: number): Ticket {
  const prioridade: Priority = c.prioridade ?? "P4";
  const ultima = new Date(c.ultima_movimentacao_em).getTime();
  const dias = Math.floor((agora - ultima) / 86_400_000);
  const backlog = c.status === "backlog_produto";
  // Backlog de produto saiu da fila de suporte: não tem SLA de atendimento.
  const slaMinutos = backlog ? SEM_SLA : Math.round((ultima + SLA_HORAS[prioridade] * 3_600_000 - agora) / 60_000);
  const escalado = c.escalado_em !== null && new Date(c.escalado_em).getTime() >= ultima;

  const motivos = [
    backlog ? "Backlog de produto" : null,
    c.prioridade === null && !backlog ? "Sem prioridade definida" : null,
    slaMinutos < 0 ? `SLA vencido há ${formatarMinutos(-slaMinutos)}` : null,
    dias >= 10 ? `Parado há ${dias} dias` : null,
    c.volume_grupo > 0 ? `+${c.volume_grupo} chamados vinculados` : null,
    c.impacto_efetivo && c.urgencia ? `Impacto ${c.impacto_efetivo} × Urgência ${c.urgencia}` : null,
  ].filter(Boolean);

  const revisao = c.justificativa_p1
    ? `P1 acima da cota da conta: ${c.justificativa_p1}`
    : escalado
      ? `Parado há ${dias} dias e escalado automaticamente`
      : undefined;

  return {
    id: c.id,
    number: c.protocolo,
    title: c.titulo,
    account: c.contas?.nome ?? "Conta não identificada",
    // Tickets do bot guardam o id da categoria do checklist; os importados, o assunto da planilha.
    category: categoriaPorId(c.categoria ?? undefined)?.nome ?? c.categoria ?? "Sem categoria",
    priority: prioridade,
    requestType: tipoDeSolicitacao(c.tipo, prioridade),
    createdAt: new Date(c.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
    firstAction: (c.descricao ?? "Sem descrição na abertura.").slice(0, 280),
    status: STATUS[c.status] ?? "Aberto",
    assignee: backlog
      ? { name: "Time de Produto" }
      : c.responsavel ? { name: c.responsavel, avatar: MOCK_TEAM_MEMBERS.find((m) => m.name === c.responsavel)?.avatar } : { name: "Sem Responsável", isUnassigned: true },
    slaMinutesRemaining: slaMinutos,
    lastUpdateHoursAgo: (agora - ultima) / 3_600_000,
    daysStagnant: dias,
    urgencyReason: motivos.join(" • ") || `Prioridade ${prioridade}`,
    isProductBacklog: backlog || undefined,
    backlogIssueKey: backlog ? c.protocolo : undefined,
    isSimilarOrChild: c.status === "vinculado" || undefined,
    parentTicketNumber: c.pai?.protocolo,
    unprioritized: c.prioridade === null || undefined,
    isNewFromBot: (c.canal === "chat" && agora - new Date(c.criado_em).getTime() < 86_400_000) || undefined,
    needsManagerReview: revisao ? true : undefined,
    managerReviewReason: revisao,
  };
}

function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)} dias`;
}

export async function dadosGestao(): Promise<{ tickets: Ticket[]; members: TeamMember[] }> {
  const { data, error } = await supabase()
    .from("chamados")
    .select(
      "id, protocolo, titulo, descricao, categoria, canal, tipo, status, prioridade, impacto_efetivo, urgencia, responsavel, volume_grupo, justificativa_p1, motivo_ajuste, escalado_em, criado_em, ultima_movimentacao_em, contas(nome), pai:chamado_pai_id(protocolo)",
    )
    .in("status", ["aberto", "na_fila", "em_atendimento", "aguardando_cliente", "vinculado", "backlog_produto"]);
  if (error) throw error;

  const agora = Date.now();
  const tickets = (data as unknown as Linha[]).map((c) => paraTicket(c, agora));
  const naFila = tickets.filter((t) => !t.isProductBacklog && !t.isSimilarOrChild);

  // Equipe: nomes, cargos e capacidade do cadastro do painel; contagens calculadas da fila real.
  const nomes = new Set([...MOCK_TEAM_MEMBERS.map((m) => m.name), ...naFila.filter((t) => !t.assignee.isUnassigned).map((t) => t.assignee.name)]);
  const members: TeamMember[] = [...nomes].map((nome, i) => {
    const base = MOCK_TEAM_MEMBERS.find((m) => m.name === nome);
    const meus = naFila.filter((t) => t.assignee.name === nome);
    return {
      id: base?.id ?? `agente-${i}`,
      name: nome,
      role: base?.role ?? "Analista de suporte",
      avatar: base?.avatar ?? "",
      status: base?.status ?? "online",
      activeTickets: meus.length,
      p1Tickets: meus.filter((t) => t.priority === "P1").length,
      breachedSlaTickets: meus.filter((t) => t.slaMinutesRemaining < 0).length,
      stagnantTickets: meus.filter((t) => t.daysStagnant >= 10).length,
      capacityLimit: base?.capacityLimit ?? 8,
    };
  });

  return { tickets, members };
}
