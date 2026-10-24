import { responder, type EntradaUsuario } from "@/lib/agent";
import { BOAS_VINDAS } from "@/lib/fluxo";
import { provedor } from "@/lib/llm";
import { buscarConversa, novaConversa } from "@/lib/store";
import type { Conversa } from "@/lib/types";

export const maxDuration = 300;

/** Estado da conversa devolvido ao widget. */
function estado(conversa: Conversa) {
  return {
    id: conversa.id,
    status: conversa.status,
    etapa: conversa.fluxo?.etapa ?? "identificacao",
    ticketId: conversa.ticketId ?? null,
    provedor: provedor(),
  };
}

/** Mensagem de boas-vindas do roteiro (o widget mostra ao abrir). */
export function GET() {
  return Response.json({ boasVindas: BOAS_VINDAS });
}

export async function POST(request: Request) {
  const { conversaId, texto, imagem, site } = (await request.json()) as {
    conversaId?: string;
    texto: string;
    imagem?: EntradaUsuario["imagem"];
    /** Enviado pelo widget; conta só quando o site fixou uma (data-conta). */
    site?: { conta?: string };
  };

  let conversa = conversaId ? buscarConversa(conversaId) : undefined;
  if (!conversa || conversa.status !== "em_atendimento") {
    conversa = novaConversa("chat", "Visitante do site", "municipe");
    // Conta fixada pelo site que instalou o widget (data-conta): o bot só pede a confirmação.
    if (site?.conta?.trim()) conversa.conta = site.conta.trim();
  }

  const { textos, opcoes } = await responder(conversa, { texto: texto ?? "", imagem });
  return Response.json({ respostas: textos, opcoes: opcoes ?? [], estado: estado(conversa) });
}
