// Opções do roteiro do bot, regras de prioridade e utilitários de texto. Para mudar uma regra, edite aqui.

/** Minúsculas e sem acento, para comparar texto livre. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.@/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const PERFIS = ["Funcionário da prefeitura", "Proponente"] as const;

/**
 * Prioridades que o bot atribui. Impacto × urgência é o par enviado à triagem do banco
 * (supabase/migrations, matriz_prioridade), que confirma a prioridade e aplica a cota de P1.
 */
export const PRIORIDADES = {
  P1: { nome: "Crítico", regra: "é preciso mexer na hora: a operação está parada ou ninguém consegue trabalhar", impacto: 3, urgencia: 3, tipo: "problema" },
  P2: { nome: "Alto", regra: "falha importante que também precisa de atenção logo, mas a operação não parou", impacto: 3, urgencia: 2, tipo: "problema" },
  P3: { nome: "Médio", regra: "problema ou dúvida que atrapalha, mas tem contorno ou afeta poucos", impacto: 2, urgencia: 2, tipo: "problema" },
  P4: { nome: "Solicitação nova", regra: "pedido de algo novo no sistema: nova configuração, campo, relatório, fluxo ou melhoria", impacto: 1, urgencia: 2, tipo: "ajuste" },
} as const;
export type CodigoPrioridade = keyof typeof PRIORIDADES;

// Regras de reserva, usadas quando o modelo não responde: sinais no texto da descrição.
const SINAIS_P1 = [
  "fora do ar", "nenhum servidor", "ninguem consegue", "ninguem da equipe", "nao consegue trabalhar", "nao conseguimos",
  "toda a equipe", "equipe toda", "equipe inteira", "todos os usuarios", "parado", "parada", "parou", "travou tudo",
];
const SINAIS_P4 = ["gostaria de", "seria bom", "solicito", "solicitacao de", "incluir", "criar um", "criar uma", "novo campo", "nova funcionalidade", "melhoria", "alterar o fluxo", "configurar"];
const SINAIS_P2 = ["erro", "falha", "nao funciona", "nao carrega", "nao consigo", "travando", "lento"];

export function prioridadePorRegras(descricao: string): CodigoPrioridade {
  const t = normalizar(descricao);
  if (SINAIS_P1.some((s) => t.includes(s))) return "P1";
  if (SINAIS_P4.some((s) => t.includes(s))) return "P4";
  if (SINAIS_P2.some((s) => t.includes(s))) return "P2";
  return "P3";
}

/** Escolha numa lista: aceita o número ("2"), o texto do botão ou parte dele. Devolve o índice ou null. */
export function escolherOpcao(resposta: string, opcoes: readonly string[]): number | null {
  const t = normalizar(resposta);
  const numero = t.match(/^(\d+)$/);
  if (numero) {
    const i = Number(numero[1]) - 1;
    return i >= 0 && i < opcoes.length ? i : null;
  }
  const i = opcoes.findIndex((o) => normalizar(o) === t || normalizar(o).startsWith(t) || t.includes(normalizar(o)));
  return i >= 0 ? i : null;
}
