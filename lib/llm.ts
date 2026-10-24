import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Chamada ao modelo para UMA tarefa de interpretação com resposta em JSON (validada com zod).
// O modelo não conduz a conversa: quem pergunta, guarda respostas e grava o ticket é o código (lib/fluxo.ts).
// Retorna null se não houver modelo configurado ou se a resposta vier inválida — o fluxo segue com regras simples.

export type Provedor = "grok" | "groq" | "claude" | "nenhum";

/** Primeira chave definida: XAI_API_KEY → Grok; GROQ_API_KEY → Groq; ANTHROPIC_API_KEY → Claude. */
export function provedor(): Provedor {
  if (process.env.XAI_API_KEY) return "grok";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";
  return "nenhum";
}

export async function interpretarJSON<T extends z.ZodTypeAny>(sistema: string, tarefa: string, schema: T): Promise<z.infer<T> | null> {
  try {
    switch (provedor()) {
      case "groq":
        return validar(schema, await chamarGroq(sistema, tarefa));
      case "grok":
        return validar(schema, await chamarGrok(sistema, tarefa));
      case "claude":
        return await chamarClaude(sistema, tarefa, schema);
      default:
        return null;
    }
  } catch (erro) {
    console.error(`[llm:${provedor()}]`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}

function validar<T extends z.ZodTypeAny>(schema: T, texto: string | null): z.infer<T> | null {
  if (!texto) return null;
  const json = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
  const r = schema.safeParse(JSON.parse(json));
  if (!r.success) console.warn("[llm] JSON fora do formato:", r.error.issues.slice(0, 3));
  return r.success ? r.data : null;
}

// --- Groq (API compatível com OpenAI). Cada modelo tem cota própria de tokens/min no plano gratuito:
// quando um estoura (429), tenta o próximo; se todos estourarem, espera uma vez.
const MODELOS_GROQ = () => [...new Set([process.env.GROQ_MODEL || "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"])];

async function chamarGroq(sistema: string, tarefa: string): Promise<string | null> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let espera = 0;
    for (const model of MODELOS_GROQ()) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: tarefa },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1200,
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
      });
      const corpo = (await r.json()) as { choices?: { message: { content: string | null } }[]; error?: { message?: string } };
      if (r.ok) return corpo.choices?.[0]?.message.content ?? null;
      if (r.status !== 429) throw new Error(`Groq ${r.status} (${model}): ${corpo.error?.message}`);
      espera = Math.max(espera, Number(r.headers.get("retry-after")) || 10);
    }
    if (tentativa === 0) await new Promise((ok) => setTimeout(ok, Math.min(espera, 20) * 1000));
  }
  throw new Error("Groq: limite de tokens por minuto em todos os modelos");
}

// --- Grok (xAI), Responses API.
async function chamarGrok(sistema: string, tarefa: string): Promise<string | null> {
  const r = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || "grok-4.7",
      input: [
        { role: "system", content: sistema },
        { role: "user", content: tarefa },
      ],
      store: false,
    }),
  });
  const corpo = (await r.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`xAI ${r.status}: ${corpo.error?.message}`);
  const mensagem = corpo.output?.find((o) => o.type === "message");
  return mensagem?.content?.find((c) => c.type === "output_text")?.text ?? null;
}

// --- Claude, com saída estruturada validada pelo próprio SDK.
let cliente: Anthropic | undefined;

async function chamarClaude<T extends z.ZodTypeAny>(sistema: string, tarefa: string, schema: T): Promise<z.infer<T> | null> {
  cliente ??= new Anthropic();
  const resposta = await cliente.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system: sistema,
    messages: [{ role: "user", content: tarefa }],
  });
  if (resposta.stop_reason === "refusal") return null;
  return resposta.parsed_output ?? null;
}
