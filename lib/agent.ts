import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { categoriaPorId, categorias, normalizar } from "./catalogo";
import { dataIso } from "./extracao";
import { agora, buscarTicket, salvar } from "./store";
import { camposDe, checklist, CONFIRMACAO, definicoesFerramentas, executarFerramenta } from "./tools";
import { responderDemo } from "./demo-agent";
import { responderComGrok } from "./grok";
import { responderComGroq } from "./groq";
import type { Conversa } from "./types";

export const MODELO = "claude-opus-5-5";
const MAX_ITERACOES = 8;

// O prompt de sistema é o INSTRUCTIONS.md da raiz, sem alterações, mais o catálogo de categorias.
// Os dois são estáveis, então o prefixo inteiro fica em cache entre conversas.
const SISTEMA = [
  fs.readFileSync(path.join(process.cwd(), "INSTRUCTIONS.md"), "utf8"),
  "## Categorias disponíveis\n\n" + categorias.map((c) => `- \`${c.id}\`: ${c.nome}. ${c.descricao}`).join("\n"),
].join("\n\n");

export interface EntradaUsuario {
  texto: string;
  imagem?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
}

export type Provedor = "grok" | "groq" | "claude" | "demo";

/** Provedor escolhido pela chave disponível: XAI_API_KEY → Grok; GROQ_API_KEY → Groq; ANTHROPIC_API_KEY → Claude; nenhuma → roteiro de demonstração. */
export function provedor(): Provedor {
  if (process.env.XAI_API_KEY) return "grok";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";
  return "demo";
}

export function modoIA(): boolean {
  return provedor() !== "demo";
}

/** Contexto do canal, enviado só no primeiro turno (fora do prompt de sistema, para não quebrar o cache). */
function contextoInicial(conversa: Conversa): string | null {
  if (conversa.turnosUsuario !== 1) return null;
  const partes = [
    `canal: ${conversa.origem === "site" ? "chat do site" : conversa.canal}`,
    `perfil: ${conversa.perfil}`,
    conversa.origem === "site"
      ? "visitante não identificado: não peça nome nem e-mail no começo; eles fazem parte do checklist e só são perguntados se for abrir chamado"
      : `requerente: ${conversa.contato}`,
    conversa.conta ? `conta já definida pelo site: ${conversa.conta} (não pergunte o município)` : null,
    `data: ${new Date().toLocaleDateString("pt-BR")}`,
  ];
  return `[contexto do sistema] ${partes.filter(Boolean).join("; ")}`;
}

let cliente: Anthropic | undefined;

/** Texto degenerado (quase só símbolos, "???", "…"): acontece com modelos menores sob carga. */
function quebrado(texto: string): boolean {
  const letras = (texto.match(/\p{L}/gu) ?? []).length;
  return letras < 8 || letras / texto.replace(/\s/g, "").length < 0.6 || /(\?\s*){3,}|(…\s*){3,}|(\*​?){4,}/u.test(texto);
}

/** O texto afirma que existe chamado ou protocolo? Só pode afirmar se o código abriu um de verdade. */
const ALEGA_CHAMADO = /protocolo|chamado (foi )?(aberto|registrado|criado)|abrindo o chamado|\bAPR?V[-‑]/i;

function confirmacaoDoTicket(conversa: Conversa): string[] {
  const ticket = buscarTicket(conversa.ticketId!);
  const prazo = ticket ? new Date(ticket.prazo).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : null;
  const retorno = conversa.email ? `O retorno chega no e-mail ${conversa.email}.` : "O acompanhamento chega por aqui mesmo.";
  return [`Chamado aberto! Protocolo *${conversa.ticketId}*.`, `${prazo ? `O suporte responde até ${prazo}. ` : ""}${retorno}`];
}

function resumoDoCodigo(conversa: Conversa): string {
  const categoria = categoriaPorId(conversa.categoria)!;
  const relato = (conversa.transcript.find((m) => m.de === "usuario")?.texto ?? categoria.nome).trim().replace(/[.!?]*$/, "");
  const dados = camposDe(conversa).map((c) => `${c.rotulo}: ${conversa.campos[c.id]?.valor}`).join("; ");
  return `${relato}. Dados coletados: ${dados}.`;
}

/**
 * O que o usuário recebe não depende só do modelo:
 * - chamado aberto neste turno → confirmação montada pelo código, com protocolo e prazo reais;
 * - "sim" ao resumo que o próprio código mostrou → o código abre o chamado;
 * - texto quebrado ou que afirma um chamado inexistente → descartado; no lugar vai o resumo
 *   (checklist completo) ou a próxima pergunta do checklist.
 */
async function garantirRespostas(conversa: Conversa, geradas: string[], ticketAntes: string | undefined): Promise<string[]> {
  if (conversa.ticketId && conversa.ticketId !== ticketAntes) {
    conversa.aguardandoConfirmacao = false;
    return confirmacaoDoTicket(conversa);
  }

  const completo = Boolean(conversa.categoria) && checklist(conversa).completo;
  const disseSim = CONFIRMACAO.test(normalizar(conversa.transcript.filter((m) => m.de === "usuario").at(-1)?.texto ?? ""));

  if (conversa.aguardandoConfirmacao && completo && disseSim && conversa.status === "em_atendimento") {
    const r = (await executarFerramenta(conversa, "abrir_chamado", {
      resumo: resumoDoCodigo(conversa),
      tipo_sugerido: conversa.categoria === "configuracao_fluxo" ? "parametrizacao" : "problema",
      prazo_data: dataIso(conversa.campos.prazo?.valor),
      confirmado_pelo_usuario: true,
    })) as { protocolo?: string };
    conversa.aguardandoConfirmacao = false;
    if (r.protocolo) return confirmacaoDoTicket(conversa);
  }
  conversa.aguardandoConfirmacao = false;

  const boas = geradas.filter((t) => !quebrado(t) && !ALEGA_CHAMADO.test(t));
  if (boas.length > 0) return boas;

  console.warn("[agente] resposta descartada (quebrada ou chamado inexistente):", geradas);
  if (completo && conversa.status === "em_atendimento") {
    conversa.aguardandoConfirmacao = true;
    const linhas = camposDe(conversa).map((c) => `• ${c.rotulo}: ${conversa.campos[c.id].valor}`).join("\n");
    return [`Confere o resumo antes de eu abrir o chamado:\n${linhas}\n\nPosso abrir? Responda *sim* ou me diga o que corrigir.`];
  }
  const proxima = conversa.categoria ? checklist(conversa).faltando[0] : undefined;
  return [proxima ? proxima.pergunta_amigavel : "Desculpe, não entendi. Pode me contar de novo o que está acontecendo?"];
}

/** Processa uma mensagem do usuário e devolve os balões de resposta do agente. */
export async function responder(conversa: Conversa, entrada: EntradaUsuario): Promise<string[]> {
  conversa.turnosUsuario += 1;
  conversa.transcript.push({ de: "usuario", texto: entrada.texto, imagem: !!entrada.imagem, em: agora() });

  const escolhido = provedor();
  const ticketAntes = conversa.ticketId;
  const geradas =
    escolhido === "grok"
      ? await responderComGrok(conversa, entrada, SISTEMA, contextoInicial(conversa))
      : escolhido === "groq"
        ? await responderComGroq(conversa, entrada, SISTEMA, contextoInicial(conversa))
        : escolhido === "claude"
          ? await responderComClaude(conversa, entrada)
          : await responderDemo(conversa, entrada);

  const respostas = await garantirRespostas(conversa, geradas, ticketAntes);
  // Se o código trocou a resposta, o histórico do modelo precisa saber o que o usuário realmente viu.
  if (respostas !== geradas && respostas.join() !== geradas.join()) {
    const visto = { role: "assistant", content: respostas.join("\n\n") };
    if (escolhido === "groq") conversa.mensagensGroq?.push(visto);
    if (escolhido === "grok") conversa.itensGrok?.push(visto);
  }

  for (const texto of respostas) conversa.transcript.push({ de: "agente", texto, em: agora() });
  conversa.atualizadaEm = agora();
  salvar();
  return respostas;
}

async function responderComClaude(conversa: Conversa, entrada: EntradaUsuario): Promise<string[]> {
  cliente ??= new Anthropic();

  const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
  const contexto = contextoInicial(conversa);
  if (contexto) conteudo.push({ type: "text", text: contexto });
  if (entrada.imagem) {
    conteudo.push({ type: "image", source: { type: "base64", media_type: entrada.imagem.mediaType, data: entrada.imagem.base64 } });
  }
  conteudo.push({ type: "text", text: entrada.texto || "(o usuário enviou uma imagem sem texto)" });
  conversa.mensagens.push({ role: "user", content: conteudo });

  const textos: string[] = [];

  for (let i = 0; i < MAX_ITERACOES; i++) {
    let resposta: Anthropic.Beta.BetaMessage;
    try {
      resposta = await cliente.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: (process.env.AGENT_EFFORT as "low" | "medium" | "high") ?? "low" },
        cache_control: { type: "ephemeral" },
        system: SISTEMA,
        tools: definicoesFerramentas,
        messages: conversa.mensagens,
      });
    } catch (erro) {
      if (erro instanceof Anthropic.RateLimitError) console.error("[agente] limite de taxa", erro.message);
      else if (erro instanceof Anthropic.APIError) console.error(`[agente] erro ${erro.status}`, erro.message);
      else console.error("[agente] falha de conexão", erro);
      // O histórico fica como está: a API aceita mensagens de usuário consecutivas.
      return ["Tive um problema técnico agora. Pode mandar sua mensagem de novo em instantes?"];
    }

    // Histórico só cresce: devolvemos o conteúdo inteiro (inclusive blocos de thinking).
    conversa.mensagens.push({ role: "assistant", content: resposta.content });

    for (const bloco of resposta.content) {
      if (bloco.type === "text" && bloco.text.trim()) textos.push(bloco.text.trim());
    }

    if (resposta.stop_reason === "refusal") {
      return ["Não consigo ajudar com esse pedido por aqui. Se for sobre a plataforma Aprova, me conte o problema de outro jeito."];
    }
    if (resposta.stop_reason === "pause_turn") continue;
    if (resposta.stop_reason !== "tool_use") break;

    // Em sequência, não em paralelo: as ferramentas alteram o mesmo estado da conversa.
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const uso of resposta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")) {
      const resultado = await executarFerramenta(conversa, uso.name, uso.input as Record<string, unknown>);
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(resultado) });
    }
    conversa.mensagens.push({ role: "user", content: resultados });
  }

  return textos.length > 0 ? textos : ["Pode me contar um pouco mais sobre o que está acontecendo?"];
}
