import type Anthropic from "@anthropic-ai/sdk";

export type Perfil = "municipe" | "analista_prefeitura";
export type Canal = "chat";

export interface Campo {
  id: string;
  rotulo: string;
  pergunta_amigavel: string;
  evidencia?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao: string;
  perfis: Perfil[];
  campos: Campo[];
}

export interface Artigo {
  id: string;
  titulo: string;
  categoria: string;
  palavras_chave: string[];
  solucao: string[];
}

export interface ValorCampo {
  valor: string;
  /** Número da mensagem do usuário em que o dado chegou (1 = primeira mensagem). */
  turno: number;
}

export interface MensagemTranscript {
  de: "usuario" | "agente";
  texto: string;
  imagem?: boolean;
  em: string;
}

export type StatusConversa = "em_atendimento" | "resolvida_autoatendimento" | "ticket_aberto";

export interface Conversa {
  id: string;
  canal: Canal;
  contato: string;
  perfil: Perfil;
  criadaEm: string;
  atualizadaEm: string;
  status: StatusConversa;
  /** Histórico enviado ao Claude. Só cresce: nunca editamos turnos anteriores. */
  mensagens: Anthropic.Beta.BetaMessageParam[];
  transcript: MensagemTranscript[];
  turnosUsuario: number;
  categoria?: string;
  campos: Record<string, ValorCampo>;
  artigosSugeridos: string[];
  artigoQueResolveu?: string;
  ticketId?: string;
  /** Histórico no formato da Responses API da xAI (provedor Grok). */
  itensGrok?: unknown[];
  /** Histórico no formato chat completions (provedor Groq). */
  mensagensGroq?: unknown[];
  /** Conversa iniciada pelo bot (widget no PrefTech ou no site de uma prefeitura). */
  origem?: "site";
  conta?: string;
  email?: string;
  /** O código mostrou o resumo e espera o "sim" para abrir o chamado. */
  aguardandoConfirmacao?: boolean;
  /** Estado do modo demonstração (sem chave de API). */
  demo?: { etapa: string; perguntando?: string; artigo?: string; relato?: string };
}

export type Prioridade = "urgente" | "alta" | "media" | "baixa";
export type StatusTicket = "novo" | "em_analise" | "resolvido";

export interface Ticket {
  id: string;
  conversaId: string;
  canal: Canal;
  perfil: Perfil;
  contato: string;
  categoria: string;
  resumo: string;
  campos: Record<string, string>;
  completude: number;
  camposColetadosPeloAgente: string[];
  prioridade: Prioridade;
  motivoPrioridade: string;
  slaHoras: number;
  prazo: string;
  criadoEm: string;
  minutosParaAbrir: number;
  status: StatusTicket;
  /** Avaliação do analista de suporte: precisou pedir complemento ao requerente? */
  precisouComplemento: boolean | null;
}

export interface Db {
  conversas: Record<string, Conversa>;
  tickets: Record<string, Ticket>;
  sequencia: number;
}
