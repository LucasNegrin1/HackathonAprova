import crypto from "crypto";
import type { EntradaUsuario } from "./agent";
import type { Perfil } from "./types";

// Adaptador da WhatsApp Cloud API (Meta). Fica inativo enquanto as variáveis não forem definidas.
const GRAPH = "https://graph.facebook.com/v21.0";

export const whatsappConfigurado = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Números de analistas de prefeitura cadastrados; os demais são tratados como munícipes. */
export function perfilDoNumero(numero: string): Perfil {
  const prefeitura = (process.env.WHATSAPP_NUMEROS_PREFEITURA ?? "").split(",").map((n) => n.trim());
  return prefeitura.includes(numero) ? "analista_prefeitura" : "municipe";
}

export function assinaturaValida(corpo: string, assinatura: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo) return true; // sem segredo configurado (ambiente de teste)
  if (!assinatura) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", segredo).update(corpo).digest("hex");
  return esperado.length === assinatura.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(assinatura));
}

export async function enviarTexto(para: string, texto: string) {
  const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  if (!r.ok) console.error("[whatsapp] falha ao enviar", r.status, await r.text());
}

async function baixarMidia(id: string): Promise<EntradaUsuario["imagem"]> {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = (await (await fetch(`${GRAPH}/${id}`, { headers: auth })).json()) as { url: string; mime_type: string };
  const arquivo = await fetch(meta.url, { headers: auth });
  const tipo = meta.mime_type.split(";")[0] as NonNullable<EntradaUsuario["imagem"]>["mediaType"];
  return { base64: Buffer.from(await arquivo.arrayBuffer()).toString("base64"), mediaType: tipo };
}

interface MensagemWhatsApp {
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string };
}

export function extrairMensagens(payload: unknown): MensagemWhatsApp[] {
  const p = payload as { entry?: { changes?: { value?: { messages?: MensagemWhatsApp[] } }[] }[] };
  return (p.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
}

export async function paraEntrada(m: MensagemWhatsApp): Promise<EntradaUsuario | null> {
  if (m.type === "text" && m.text) return { texto: m.text.body };
  if (m.type === "image" && m.image) return { texto: m.image.caption ?? "", imagem: await baixarMidia(m.image.id) };
  return null;
}
