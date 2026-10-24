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

const SINAIS_BLOQUEIO = ["todos", "ninguem consegue", "parado", "parou", "travou tudo", "equipe toda", "toda a equipe", "fora do ar", "nao funciona para ninguem"];
const SINAIS_PRAZO = ["vence hoje", "vence amanha", "prazo legal", "multa", "embargo", "urgente"];

export interface ResultadoPrioridade {
  prioridade: Prioridade;
  motivo: string;
  slaHoras: number;
  prazo: Date;
}

export function calcularPrioridade(categoria: string, perfil: Perfil, campos: Record<string, string>): ResultadoPrioridade {
  const texto = normalizar(Object.values(campos).join(" "));
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
  } else if (prazo) {
    prioridade = "alta";
    motivo = `risco de prazo ("${prazo}")`;
  }

  const slaHoras = SLA_HORAS[prioridade];
  return { prioridade, motivo, slaHoras, prazo: new Date(Date.now() + slaHoras * 3_600_000) };
}
