export type Perfil = "municipe" | "analista_prefeitura";
export type Canal = "chat";

export interface MensagemTranscript {
  de: "usuario" | "agente";
  texto: string;
  imagem?: boolean;
  em: string;
}

/** Estado do roteiro do bot (lib/fluxo.ts). As respostas ficam em `dados`. */
export interface EstadoFluxo {
  etapa: "nome" | "prefeitura" | "perfil" | "descricao" | "revisao" | "complemento" | "encerrado";
  dados: {
    nome?: string;
    conta?: string;
    descricao?: string;
    /** Já pediu "me conte mais" sobre a descrição. */
    pediuMais?: boolean;
    /** Título, prioridade e texto sugerido pelo modelo, à espera da aprovação do usuário. */
    classificacao?: {
      titulo: string;
      prioridade: "P1" | "P2" | "P3" | "P4";
      motivo: string;
      textoSugerido: string | null;
      faltando: string[];
    };
  };
}

export type StatusConversa = "em_atendimento" | "ticket_aberto" | "cancelada";

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
  ticketId?: string;
  /** Conta fixada pelo site que instalou o widget (data-conta). */
  conta?: string;
  fluxo?: EstadoFluxo;
}

export interface Db {
  conversas: Record<string, Conversa>;
  sequencia: number;
}
