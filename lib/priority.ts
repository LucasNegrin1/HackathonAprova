import { normalizar } from "./catalogo";
import type { Perfil, Prioridade } from "./types";

// Regras de prioridade e prazo (SLA). Código clássico: o agente não decide prioridade.
const SLA_HORAS: Record<Prioridade, number> = { urgente: 4, alta: 8, media: 24, baixa: 72 };

const PADRAO_POR_CATEGORIA: Record<string, Prioridade> = {
  acesso_login: "media",
  pagamento_taxa: "media",
  envio_documentos: "media",
  andamento_processo: "baixa",
  erro_sistema: "media",
  configuracao_fluxo: "baixa",
};

const SINAIS_BLOQUEIO = [
  "todos", "todas as", "ninguem consegue", "ninguem da equipe", "nao consegue trabalhar", "nao conseguimos trabalhar",
  "parado", "parada", "parou", "travou tudo", "equipe toda", "toda a equipe", "equipe inteira", "fora do ar",
  "nao funciona para ninguem",
];
const SINAIS_PRAZO = ["vence hoje", "vence amanha", "ate hoje", "ate amanha", "para hoje", "para amanha", "prazo legal", "multa", "embargo", "urgente"];

export interface ResultadoPrioridade {
  prioridade: Prioridade;
  motivo: string;
  slaHoras: number;
  prazo: Date;
}

/** `relato`: mensagens do usuário. O modelo pode reescrever o checklist com outras palavras; o relato original não. */
export function calcularPrioridade(categoria: string, perfil: Perfil, campos: Record<string, string>, relato = ""): ResultadoPrioridade {
  const texto = normalizar(`${Object.values(campos).join(" ")} ${relato}`);
  // "amanhã"/"hoje" sozinhos no campo prazo também indicam urgência.
  const prazoCurto = /^(hoje|amanha)\b/.test(normalizar(campos.prazo ?? ""));
  let prioridade = PADRAO_POR_CATEGORIA[categoria] ?? "media";
  let motivo = "padrão da categoria";

  const bloqueio = SINAIS_BLOQUEIO.find((s) => texto.includes(s));
  const prazo = SINAIS_PRAZO.find((s) => texto.includes(s));

  if (bloqueio && perfil === "analista_prefeitura") {
    prioridade = "urgente";
    motivo = `prefeitura com operação bloqueada ("${bloqueio}")`;
  } else if (bloqueio) {
    prioridade = "alta";
    motivo = `atendimento bloqueado ("${bloqueio}")`;
  } else if (prazo || prazoCurto) {
    prioridade = "alta";
    motivo = `risco de prazo ("${prazo ?? campos.prazo}")`;
  }

  const slaHoras = SLA_HORAS[prioridade];
  return { prioridade, motivo, slaHoras, prazo: new Date(Date.now() + slaHoras * 3_600_000) };
}
