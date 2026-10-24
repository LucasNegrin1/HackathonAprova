import { definicoesFerramentas, executarFerramenta } from "./tools";
import type { EntradaUsuario } from "./agent";
import type { Conversa } from "./types";

// Provedor Groq (groq.com), API compatível com a OpenAI (chat completions + tools).
// Mesmas regras dos outros provedores: INSTRUCTIONS.md como prompt e ferramentas em código decidindo.
const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MAX_ITERACOES = 8;

type Mensagem = Record<string, unknown>;

interface RespostaGroq {
  choices?: {
    finish_reason: string;
    message: { content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] };
  }[];
  error?: { message?: string };
}

const ferramentas = definicoesFerramentas.map((f) => ({
  type: "function",
  function: { name: f.name, description: f.description, parameters: "input_schema" in f ? f.input_schema : {} },
}));

// Os modelos de texto da Groq não leem imagem: o agente sabe que houve anexo e registra como evidência.
const AVISO_IMAGEM =
  "[o usuário anexou uma imagem (print ou foto). Você não consegue ver o conteúdo. Se o checklist pedir evidência, registre \"print enviado pelo usuário\".]";

class LimiteExcedido extends Error {}

// Cada modelo tem a própria cota de tokens por minuto no plano gratuito da Groq.
// Quando um estoura (429), tentamos o próximo da lista; se todos estourarem, esperamos uma vez.
function modelos(): string[] {
  return [...new Set([process.env.GROQ_MODEL || "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"])];
}

async function chamar(messages: Mensagem[]): Promise<RespostaGroq> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let espera = 0;
    for (const model of modelos()) {
      const r = await fetch(URL_GROQ, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: ferramentas,
          tool_choice: "auto",
          parallel_tool_calls: false,
          max_completion_tokens: 1500,
          // Raciocínio curto nos gpt-oss: resposta mais rápida e menos tokens contra a cota.
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
      });
      const corpo = (await r.json()) as RespostaGroq;
      if (r.ok) {
        console.info(`[groq] respondeu: ${model}`);
        return corpo;
      }
      if (r.status !== 429) throw new Error(`Groq ${r.status} (${model}): ${corpo.error?.message ?? JSON.stringify(corpo)}`);
      espera = Math.max(espera, Number(r.headers.get("retry-after")) || 10);
      console.warn(`[groq] limite em ${model}, tentando o próximo`);
    }
    // Melhor o usuário esperar alguns segundos do que receber erro.
    if (tentativa === 0) await new Promise((ok) => setTimeout(ok, Math.min(espera, 20) * 1000));
  }
  throw new LimiteExcedido("Groq: limite de tokens por minuto em todos os modelos");
}

/**
 * Economia de tokens: de cada ferramenta, só o resultado mais recente vai completo.
 * Os anteriores viram um marcador curto (o estado atual do checklist está sempre no último).
 */
function compactar(historico: Mensagem[]): Mensagem[] {
  const nomePorId = new Map<string, string>();
  for (const m of historico) {
    for (const t of (m.tool_calls as { id: string; function: { name: string } }[] | undefined) ?? []) nomePorId.set(t.id, t.function.name);
  }
  const ultimoPorNome = new Map<string, number>();
  historico.forEach((m, i) => {
    if (m.role === "tool") ultimoPorNome.set(nomePorId.get(m.tool_call_id as string) ?? "", i);
  });
  return historico.map((m, i) =>
    m.role === "tool" && ultimoPorNome.get(nomePorId.get(m.tool_call_id as string) ?? "") !== i
      ? { ...m, content: '{"omitido":"resultado antigo; veja o mais recente desta ferramenta"}' }
      : m,
  );
}

/** Converte markdown comum para o formato do chat (*negrito*) e tira separadores e títulos. */
function formatoChat(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]\s?/gu, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/["}\]]+\s*$/, "")
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function responderComGroq(conversa: Conversa, entrada: EntradaUsuario, sistema: string, contexto: string | null): Promise<string[]> {
  const historico = (conversa.mensagensGroq ??= []) as Mensagem[];
  const partes = [contexto, entrada.imagem ? AVISO_IMAGEM : null, entrada.texto || "(sem texto)"].filter(Boolean);
  historico.push({ role: "user", content: partes.join("\n\n") });

  const textos: string[] = [];

  for (let i = 0; i < MAX_ITERACOES; i++) {
    let resposta: RespostaGroq;
    try {
      resposta = await chamar([{ role: "system", content: sistema }, ...compactar(historico)]);
    } catch (erro) {
      console.error("[groq]", erro);
      return [
        erro instanceof LimiteExcedido
          ? "Estamos com muitos atendimentos agora. Pode mandar sua mensagem de novo em um minuto?"
          : "Tive um problema técnico agora. Pode mandar sua mensagem de novo em instantes?",
      ];
    }

    const escolha = resposta.choices?.[0];
    if (!escolha) break;
    const { content, tool_calls } = escolha.message;

    historico.push({ role: "assistant", content: content ?? "", ...(tool_calls?.length ? { tool_calls } : {}) });
    if (content?.trim()) textos.push(formatoChat(content));
    if (!tool_calls?.length) break;

    for (const chamada of tool_calls) {
      let resultado: unknown;
      try {
        resultado = await executarFerramenta(conversa, chamada.function.name, JSON.parse(chamada.function.arguments || "{}") as Record<string, unknown>);
      } catch {
        resultado = { erro: "Argumentos inválidos (JSON). Chame a ferramenta de novo com JSON válido." };
      }
      historico.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(resultado) });
    }
  }

  return textos.length > 0 ? textos : ["Pode me contar um pouco mais sobre o que está acontecendo?"];
}
