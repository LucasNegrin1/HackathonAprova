import { responder, type EntradaUsuario } from "@/lib/agent";
import { categoriaPorId } from "@/lib/catalogo";
import { provedor } from "@/lib/llm";
import { buscarConversa, novaConversa } from "@/lib/store";
import { camposDe, faltando } from "@/lib/tools";
import type { Conversa } from "@/lib/types";

export const maxDuration = 300;

/** Estado da conversa devolvido ao widget (status, checklist e protocolo). */
function estado(conversa: Conversa) {
  return {
    id: conversa.id,
    status: conversa.status,
    etapa: conversa.fluxo?.etapa ?? "inicio",
    perfil: conversa.perfil,
    categoria: categoriaPorId(conversa.categoria)?.nome ?? null,
    pendentes: conversa.categoria ? faltando(conversa).map((c) => c.id) : [],
    perguntando: conversa.fluxo?.etapa === "coletando" ? conversa.fluxo.perguntando : null,
    campos: camposDe(conversa).length,
    ticketId: conversa.ticketId ?? null,
    provedor: provedor(),
  };
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
    // Sem identificação para conversar: perfil, nome e e-mail são resolvidos durante o atendimento.
    conversa = novaConversa("chat", "Visitante do site", "municipe");
    conversa.origem = "site";
    if (site?.conta?.trim()) {
      // Conta fixada pelo site que instalou o widget (data-conta): o bot não pergunta o município.
      conversa.conta = site.conta.trim();
      conversa.campos.municipio = { valor: conversa.conta, turno: 1 };
    }
  }

  const { textos, opcoes } = await responder(conversa, { texto: texto ?? "", imagem });
  return Response.json({ respostas: textos, opcoes: opcoes ?? [], estado: estado(conversa) });
}
