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

export interface EstadoFluxo {
  etapa: "inicio" | "kb" | "perfil" | "coletando" | "confirmar" | "corrigindo" | "encerrado";
  relato?: string;
  resumo?: string;
  tipo?: "problema" | "duvida" | "ajuste" | "sugestao" | "parametrizacao";
  perfilDefinido?: boolean;
  /** Campo do checklist perguntado por último. */
  perguntando?: string;
  artigo?: string;
  /** Já repetiu a pergunta atual uma vez. */
  repetiu?: boolean;
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
  transcript: MensagemTranscript[];
  turnosUsuario: number;
  categoria?: string;
  campos: Record<string, ValorCampo>;
  artigosSugeridos: string[];
  artigoQueResolveu?: string;
  ticketId?: string;
  /** Conversa iniciada pelo bot (widget no PrefTech ou no site de uma prefeitura). */
  origem?: "site";
  conta?: string;
  email?: string;
  /** Etapa do roteiro de atendimento (lib/fluxo.ts). */
  fluxo?: EstadoFluxo;
}


export type Prioridade = "urgente" | "alta" | "media" | "baixa";

export interface Db {
  conversas: Record<string, Conversa>;
  sequencia: number;
}
