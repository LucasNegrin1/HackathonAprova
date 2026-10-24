import fs from "fs";
import path from "path";
import { z } from "zod";
import { categorias, normalizar } from "./catalogo";
import { interpretarJSON } from "./llm";
import type { Campo, Categoria, Perfil } from "./types";

// O modelo só interpreta texto livre; as regras do atendimento estão no código (lib/fluxo.ts).
// O prompt de sistema é o INSTRUCTIONS.md da raiz, sem alterações.
const SISTEMA = fs.readFileSync(path.join(process.cwd(), "INSTRUCTIONS.md"), "utf8");

const TIPOS = ["problema", "duvida", "ajuste", "sugestao", "parametrizacao"] as const;
export type Tipo = (typeof TIPOS)[number];

const CampoValor = z.object({ id: z.string(), valor: z.string() });

const Interpretacao = z.object({
  categoria: z.enum(categorias.map((c) => c.id) as [string, ...string[]]),
  tipo: z.enum(TIPOS),
  resumo: z.string(),
  campos: z.array(CampoValor),
});
export type ResultadoInterpretacao = z.infer<typeof Interpretacao>;

const Extracao = z.object({ campos: z.array(CampoValor) });

function listaCampos(campos: Campo[]) {
  return campos.map((c) => `- ${c.id}: ${c.rotulo}`).join("\n");
}

/** Primeira mensagem: o que é o problema e o que já foi informado. */
export async function interpretarRelato(relato: string, contaFixa?: string): Promise<ResultadoInterpretacao> {
  const tarefa = `TAREFA: interpretar_relato

Categorias e os campos de cada uma:
${categorias.map((c) => `## ${c.id} (${c.nome}): ${c.descricao}\n${listaCampos(c.campos)}`).join("\n\n")}

${contaFixa ? `A conta (prefeitura) já é conhecida: ${contaFixa}.\n\n` : ""}Mensagem do usuário:
"""
${relato}
"""

Responda só com JSON neste formato:
{"categoria": "<id>", "tipo": "problema" | "duvida" | "ajuste" | "sugestao" | "parametrizacao", "resumo": "<1 frase>", "campos": [{"id": "<id de campo da categoria escolhida>", "valor": "<palavras do usuário>"}]}`;

  const r = await interpretarJSON(SISTEMA, tarefa, Interpretacao);
  if (r) {
    const validos = new Set(categorias.find((c) => c.id === r.categoria)!.campos.map((c) => c.id));
    return { ...r, campos: r.campos.filter((c) => validos.has(c.id) && c.valor.trim()) };
  }
  return interpretarPorRegras(relato);
}

/**
 * Resposta do usuário durante a coleta: preenche a pergunta feita e qualquer outro campo pendente
 * que a mensagem já responda. Sem modelo, a resposta inteira vai para o campo perguntado.
 */
export async function extrairResposta(
  texto: string,
  perguntado: Campo,
  pendentes: Campo[],
): Promise<{ campos: { id: string; valor: string }[]; usouModelo: boolean }> {
  const tarefa = `TAREFA: extrair_resposta

Pergunta feita ao usuário (campo ${perguntado.id}): "${perguntado.pergunta_amigavel}"

Campos ainda pendentes:
${listaCampos(pendentes)}

Resposta do usuário:
"""
${texto}
"""

Responda só com JSON: {"campos": [{"id": "<id da lista>", "valor": "<palavras do usuário>"}]}`;

  const r = await interpretarJSON(SISTEMA, tarefa, Extracao);
  if (r) {
    const validos = new Set(pendentes.map((c) => c.id));
    return { campos: r.campos.filter((c) => validos.has(c.id) && c.valor.trim()), usouModelo: true };
  }
  return { campos: [{ id: perguntado.id, valor: texto.trim() }], usouModelo: false };
}

/** Correção depois do resumo: atualiza qualquer campo do checklist. */
export async function extrairCorrecao(texto: string, campos: Campo[]): Promise<{ id: string; valor: string }[]> {
  const tarefa = `TAREFA: extrair_correcao

Campos do chamado:
${listaCampos(campos)}

Correção enviada pelo usuário:
"""
${texto}
"""

Responda só com JSON: {"campos": [{"id": "<id da lista>", "valor": "<novo valor, com as palavras do usuário>"}]}`;
  const r = await interpretarJSON(SISTEMA, tarefa, Extracao);
  const validos = new Set(campos.map((c) => c.id));
  return r ? r.campos.filter((c) => validos.has(c.id) && c.valor.trim()) : [];
}

// ---------------------------------------------------------------------------
// Regras simples: usadas sem modelo configurado ou quando a resposta do modelo vem inválida.
// ---------------------------------------------------------------------------

const PALAVRAS_CATEGORIA: Record<string, string[]> = {
  acesso_login: ["senha", "login", "entrar", "acesso", "gov.br", "conta", "cadastro"],
  pagamento_taxa: ["paguei", "pagamento", "guia", "boleto", "taxa", "pix"],
  envio_documentos: ["anexar", "anexo", "upload", "arquivo", "documento", "pdf", "enviar"],
  andamento_processo: ["parado", "andamento", "status", "exigencia", "demora"],
  erro_sistema: ["erro", "bug", "tela", "travou", "lento", "relatorio", "botao", "nao carrega", "problema"],
  configuracao_fluxo: ["configurar", "fluxo", "alterar", "mudar", "permissao", "formulario", "incluir campo"],
};

// Pistas explícitas de quem está falando. Sem uma delas, o bot pergunta (o modelo tende a "chutar").
const PREFEITURA =
  /\b(sou (da|do) (prefeitura|municipio|secretaria|setor)|aqui na prefeitura|trabalho na prefeitura|servidor|servidora|analista|fiscal|secretaria|nossa equipe|nosso setor|equipe de analise|setor de|os processos que analisamos|nossos requerentes)\b/;
const MUNICIPE =
  /\b(meu processo|minha obra|meu alvara|meu projeto|minha casa|meu imovel|meu terreno|meu cliente|sou engenheir[oa]|sou arquitet[oa]|sou o requerente|contribuinte|requerente|cidadao|paguei|minha taxa|minha guia)\b/;

/** Quem está falando, só quando o texto traz uma pista explícita. */
export function detectarPerfil(texto: string): Perfil | null {
  const t = normalizar(texto);
  if (PREFEITURA.test(t)) return "analista_prefeitura";
  if (MUNICIPE.test(t)) return "municipe";
  return null;
}

function interpretarPorRegras(relato: string): ResultadoInterpretacao {
  const t = normalizar(relato);
  let categoria: Categoria["id"] = "erro_sistema";
  let maior = 0;
  for (const [id, palavras] of Object.entries(PALAVRAS_CATEGORIA)) {
    const pontos = palavras.filter((p) => t.includes(p)).length;
    if (pontos > maior) [categoria, maior] = [id, pontos];
  }
  const tipo: Tipo = /sugest|melhoria|seria bom|poderia ter/.test(t)
    ? "sugestao"
    : categoria === "configuracao_fluxo"
      ? "parametrizacao"
      : /como faco|como fazer|duvida|onde encontro/.test(t)
        ? "duvida"
        : "problema";
  return { categoria, tipo, resumo: relato.trim().slice(0, 160), campos: [] };
}
