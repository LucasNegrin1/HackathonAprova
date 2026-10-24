import { provedor, responder, type EntradaUsuario } from "@/lib/agent";
import { categoriaPorId } from "@/lib/catalogo";
import { camposDe, checklist } from "@/lib/tools";
import { buscarConversa, novaConversa } from "@/lib/store";
import type { Conversa, Perfil } from "@/lib/types";

export const maxDuration = 300;

/** Estado da conversa devolvido ao widget (status, checklist e protocolo). */
function bastidores(conversa: Conversa) {
  const categoria = categoriaPorId(conversa.categoria);
  return {
    id: conversa.id,
    status: conversa.status,
    perfil: conversa.perfil,
    categoria: categoria?.nome ?? null,
    campos: categoria
      ? camposDe(conversa).map((c) => ({
          id: c.id,
          rotulo: c.rotulo,
          valor: conversa.campos[c.id]?.valor ?? null,
          coletadoPeloAgente: (conversa.campos[c.id]?.turno ?? 0) > 1 && !/^n[aã]o sabe/i.test(conversa.campos[c.id]?.valor ?? ""),
        }))
      : [],
    completo: categoria ? checklist(conversa).completo : false,
    artigosSugeridos: conversa.artigosSugeridos,
    artigoQueResolveu: conversa.artigoQueResolveu ?? null,
    ticketId: conversa.ticketId ?? null,
    modo: provedor() === "demo" ? "demo" : "ia",
    provedor: provedor(),
  };
}

export async function POST(request: Request) {
  const { conversaId, perfil, texto, imagem, site } = (await request.json()) as {
    conversaId?: string;
    perfil: Perfil;
    texto: string;
    imagem?: EntradaUsuario["imagem"];
    /** Enviado pelo widget do site; conta só quando o site fixou uma (data-conta). */
    site?: { conta?: string };
  };

  let conversa = conversaId ? buscarConversa(conversaId) : undefined;
  if (!conversa || conversa.status !== "em_atendimento") {
    // Sem identificação para conversar: nome e e-mail entram no checklist só se for abrir chamado.
    conversa = novaConversa("chat", "Visitante do site", perfil);
    conversa.origem = "site";
    if (site?.conta?.trim()) {
      // Conta fixada pelo site que instalou o widget (data-conta): o agente não pergunta o município.
      conversa.conta = site.conta.trim();
      conversa.campos.municipio = { valor: conversa.conta, turno: 1 };
    }
  }

  const respostas = await responder(conversa, { texto: texto ?? "", imagem });
  return Response.json({ respostas, estado: bastidores(conversa) });
}
