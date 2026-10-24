import { definicoesFerramentas, executarFerramenta } from "./tools";
import type { EntradaUsuario } from "./agent";
import type { Conversa } from "./types";

// Provedor Grok (xAI) pela Responses API. As regras são as mesmas do Claude:
// o INSTRUCTIONS.md vira o prompt de sistema e as ferramentas em código decidem.
const URL_XAI = "https://api.x.ai/v1/responses";
const MAX_ITERACOES = 8;

type Item = Record<string, unknown>;

interface RespostaXai {
  status?: string;
  output?: { type: string; role?: string; content?: { type: string; text?: string }[]; name?: string; arguments?: string; call_id?: string }[];
  error?: { message?: string };
}

// Mesmas ferramentas do Claude, no formato de função da xAI.
const ferramentas = definicoesFerramentas.map((f) => ({
  type: "function",
  name: f.name,
  description: f.description,
  parameters: "input_schema" in f ? f.input_schema : {},
}));

/**
 * Sem estado no servidor da xAI (store: false): reenviamos o histórico a cada chamada.
 * A documentação da xAI desaconselha guardar histórico no servidor quando há imagens.
 */
export async function responderComGrok(conversa: Conversa, entrada: EntradaUsuario, sistema: string, contexto: string | null): Promise<string[]> {
  const itens = (conversa.itensGrok ??= []) as Item[];

  const conteudo: Item[] = [];
  if (contexto) conteudo.push({ type: "input_text", text: contexto });
  if (entrada.imagem) conteudo.push({ type: "input_image", image_url: `data:${entrada.imagem.mediaType};base64,${entrada.imagem.base64}` });
  conteudo.push({ type: "input_text", text: entrada.texto || "(o usuário enviou uma imagem sem texto)" });
  itens.push({ role: "user", content: conteudo });

  const textos: string[] = [];

  for (let i = 0; i < MAX_ITERACOES; i++) {
    let resposta: RespostaXai;
    try {
      const r = await fetch(URL_XAI, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.XAI_MODEL || "grok-4.7",
          input: [{ role: "system", content: sistema }, ...itens],
          tools: ferramentas,
          tool_choice: "auto",
          parallel_tool_calls: false,
          store: false,
        }),
      });
      resposta = (await r.json()) as RespostaXai;
      if (!r.ok) throw new Error(`xAI ${r.status}: ${resposta.error?.message ?? JSON.stringify(resposta)}`);
    } catch (erro) {
      console.error("[grok]", erro);
      return ["Tive um problema técnico agora. Pode mandar sua mensagem de novo em instantes?"];
    }

    const chamadas: { name: string; arguments: string; call_id: string }[] = [];
    for (const item of resposta.output ?? []) {
      if (item.type === "message") {
        const texto = (item.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("").trim();
        if (texto) {
          textos.push(texto);
          itens.push({ role: "assistant", content: texto });
        }
      } else if (item.type === "function_call" && item.name && item.call_id) {
        chamadas.push({ name: item.name, arguments: item.arguments ?? "{}", call_id: item.call_id });
        itens.push({ type: "function_call", name: item.name, arguments: item.arguments ?? "{}", call_id: item.call_id });
      }
      // Itens de raciocínio ("reasoning") não são reenviados.
    }

    if (chamadas.length === 0) break;

    for (const chamada of chamadas) {
      let resultado: unknown;
      try {
        resultado = await executarFerramenta(conversa, chamada.name, JSON.parse(chamada.arguments) as Record<string, unknown>);
      } catch {
        resultado = { erro: "Argumentos inválidos (JSON). Chame a ferramenta de novo com JSON válido." };
      }
      itens.push({ type: "function_call_output", call_id: chamada.call_id, output: JSON.stringify(resultado) });
    }
  }

  return textos.length > 0 ? textos : ["Pode me contar um pouco mais sobre o que está acontecendo?"];
}
