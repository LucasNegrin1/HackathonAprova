import type Anthropic from "@anthropic-ai/sdk";
import { artigos, categoriaPorId, categorias, normalizar } from "./catalogo";
import { buscarArtigos } from "./knowledge";
import { extrairIdentificadores } from "./extracao";
import { calcularPrioridade } from "./priority";
import { agora, gravarTicket, proximoProtocolo } from "./store";
import { gravarChamadoSupabase, supabaseConfigurado } from "./supabase";
import type { Campo, Conversa, Perfil, Ticket } from "./types";

// Ferramentas do agente. As regras que precisam ser garantidas moram aqui, não no prompt:
// o agente não consegue abrir um chamado incompleto porque abrir_chamado recusa.

export const definicoesFerramentas: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar_solucao",
    description:
      "Busca na base de conhecimento da Aprova artigos que resolvem o problema relatado. Use antes de abrir chamado. Devolve até 3 artigos com passo a passo.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "O problema com as palavras do usuário e sinônimos úteis." },
      },
      required: ["consulta"],
      additionalProperties: false,
    },
  },
  {
    name: "encerrar_resolvido",
    description:
      "Encerra o atendimento SEM abrir chamado, porque o usuário confirmou que a solução de um artigo resolveu. Só use após confirmação explícita.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { artigo_id: { type: "string", description: "ID do artigo que resolveu, ex.: KB-003." } },
      required: ["artigo_id"],
      additionalProperties: false,
    },
  },
  {
    name: "classificar_chamado",
    description:
      "Define a categoria do chamado e o perfil de quem está falando. Devolve o checklist de informações que o suporte precisa e quais já estão preenchidas.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        categoria: { type: "string", enum: categorias.map((c) => c.id) },
        perfil: { type: "string", enum: ["municipe", "analista_prefeitura"] },
      },
      required: ["categoria", "perfil"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_informacoes",
    description:
      "Registra informações do checklist que o usuário já forneceu (inclusive na primeira mensagem ou em print). Devolve o que ainda falta. Use \"não sabe\" quando o usuário não souber.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        campos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID do campo do checklist." },
              valor: { type: "string", description: "Valor informado, fiel ao que o usuário disse." },
            },
            required: ["id", "valor"],
            additionalProperties: false,
          },
        },
      },
      required: ["campos"],
      additionalProperties: false,
    },
  },
  {
    name: "abrir_chamado",
    description:
      "Abre o chamado para o time de suporte. Só funciona com o checklist completo e depois que o usuário confirmou o resumo. Devolve protocolo, prioridade e prazo.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        resumo: {
          type: "string",
          description: "Resumo técnico para o analista de suporte: o problema, o que já foi tentado e o impacto. 2 a 4 frases.",
        },
        tipo_sugerido: {
          type: "string",
          enum: ["problema", "duvida", "ajuste", "sugestao", "parametrizacao"],
          description:
            "problema: algo não funciona; duvida: como fazer; ajuste: corrigir dado ou configuração existente; sugestao: ideia de melhoria; parametrizacao: novo fluxo, formulário ou taxa.",
        },
        prazo_data: {
          type: "string",
          description: "Prazo informado pelo usuário convertido para AAAA-MM-DD. String vazia se não houver data.",
        },
        confirmado_pelo_usuario: { type: "boolean" },
      },
      required: ["resumo", "tipo_sugerido", "prazo_data", "confirmado_pelo_usuario"],
      additionalProperties: false,
    },
  },
];

type Entrada = Record<string, unknown>;

// Regras de conversa verificadas em código, sem confiar no que o modelo declara:
// "não sabe" só vale se o usuário disse que não sabe; abrir chamado exige um "sim" do usuário.
const NAO_SEI = /\b(nao sei|nao lembro|nao tenho|nao sabe|sei la|desconheco|nao faco ideia)\b/;
export const CONFIRMACAO = /^(sim|s|pode|pode abrir|pode sim|confirmo|confirmado|ok|isso|correto|certo|tudo certo|esta certo|claro|positivo)\b/;

function ultimaDoUsuario(conversa: Conversa): string {
  return normalizar(conversa.transcript.filter((m) => m.de === "usuario").at(-1)?.texto ?? "");
}

// Pedidos de senha/código não devem ser guardados no ticket.
const DADO_SENSIVEL = /(senha|password|c[oó]digo de verifica|cvv|cart[aã]o)\s*[:=]?\s*\S+/i;

// Chat do site: ninguém se identifica para conversar. Nome e e-mail só são pedidos quando
// for abrir chamado, por isso ficam no fim do checklist (depois dos dados do problema).
const IDENTIFICACAO_SITE: Campo[] = [
  { id: "nome", rotulo: "Nome", pergunta_amigavel: "Para registrar o chamado, qual é o seu nome?" },
  { id: "email_retorno", rotulo: "E-mail para retorno", pergunta_amigavel: "Em qual e-mail você quer receber o retorno do suporte?" },
];
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checklist da conversa: campos da categoria e, no chat do site, a identificação do requerente. */
export function camposDe(conversa: Conversa): Campo[] {
  const categoria = categoriaPorId(conversa.categoria);
  if (!categoria) return [];
  return conversa.origem === "site" ? [...categoria.campos, ...IDENTIFICACAO_SITE] : categoria.campos;
}

function faltando(conversa: Conversa) {
  return camposDe(conversa).filter((c) => !conversa.campos[c.id]?.valor?.trim());
}

/**
 * Em que mensagem do usuário o dado apareceu pela primeira vez. Se o valor já estava escrito
 * no relato inicial, ele não conta como complemento evitado, mesmo que o agente só o registre depois.
 */
function turnoDeOrigem(conversa: Conversa, valor: string): number {
  const alvo = normalizar(valor);
  const mensagens = conversa.transcript.filter((m) => m.de === "usuario");
  const indice = alvo.length >= 3 ? mensagens.findIndex((m) => normalizar(m.texto).includes(alvo)) : -1;
  return indice >= 0 ? indice + 1 : conversa.turnosUsuario;
}

function checklist(conversa: Conversa) {
  const pendentes = faltando(conversa);
  return {
    completo: pendentes.length === 0,
    preenchidos: Object.fromEntries(Object.entries(conversa.campos).map(([k, v]) => [k, v.valor])),
    faltando: pendentes.map(({ id, rotulo, pergunta_amigavel, evidencia }) => ({ id, rotulo, pergunta_amigavel, evidencia: !!evidencia })),
  };
}

const TIPOS = new Set(["problema", "duvida", "ajuste", "sugestao", "parametrizacao"]);

/** Aceita só AAAA-MM-DD de uma data real; qualquer outra coisa vira "sem prazo". */
function dataValida(texto: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return undefined;
  const data = new Date(`${texto}T12:00:00Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto ? undefined : texto;
}

// Sugestão de impacto × urgência para a triagem do suporte, a partir da regra de prioridade do agente.
const SUGESTAO: Record<string, [number, number]> = { urgente: [3, 3], alta: [3, 2], media: [2, 2], baixa: [1, 2] };

export async function executarFerramenta(conversa: Conversa, nome: string, entrada: Entrada): Promise<unknown> {
  switch (nome) {
    case "buscar_solucao": {
      const resultados = buscarArtigos(String(entrada.consulta ?? ""));
      for (const r of resultados) {
        if (!conversa.artigosSugeridos.includes(r.artigo.id)) conversa.artigosSugeridos.push(r.artigo.id);
      }
      if (resultados.length === 0) return { encontrou: false, orientacao: "Nenhum artigo aplicável. Siga para classificar_chamado." };
      return {
        encontrou: true,
        artigos: resultados.map(({ artigo }) => ({ id: artigo.id, titulo: artigo.titulo, passos: artigo.solucao })),
      };
    }

    case "encerrar_resolvido": {
      conversa.status = "resolvida_autoatendimento";
      conversa.artigoQueResolveu = String(entrada.artigo_id ?? "");
      conversa.categoria ??= artigos.find((a) => a.id === conversa.artigoQueResolveu)?.categoria;
      return { ok: true, orientacao: "Atendimento encerrado sem chamado. Despeça-se em uma frase." };
    }

    case "classificar_chamado": {
      const categoria = categoriaPorId(String(entrada.categoria));
      if (!categoria) return { erro: "categoria desconhecida" };
      conversa.categoria = categoria.id;
      conversa.perfil = entrada.perfil as Perfil;
      // Campos registrados antes que não pertencem à nova categoria são descartados.
      const validos = new Set(camposDe(conversa).map((c) => c.id));
      for (const id of Object.keys(conversa.campos)) if (!validos.has(id)) delete conversa.campos[id];
      // Identificadores já escritos pelo usuário entram sozinhos, sem depender do modelo.
      for (const m of conversa.transcript.filter((t) => t.de === "usuario")) {
        for (const { id, valor } of extrairIdentificadores(m.texto)) {
          if (validos.has(id) && !conversa.campos[id]) conversa.campos[id] = { valor, turno: turnoDeOrigem(conversa, valor) };
        }
      }
      return { categoria: categoria.nome, ...checklist(conversa) };
    }

    case "registrar_informacoes": {
      const categoria = categoriaPorId(conversa.categoria);
      if (!categoria) return { erro: "Chame classificar_chamado antes de registrar informações." };
      const ignorados: string[] = [];
      for (const item of (entrada.campos as { id: string; valor: string }[]) ?? []) {
        const valor = item.valor?.trim();
        if (!camposDe(conversa).some((c) => c.id === item.id) || !valor) {
          ignorados.push(item.id);
          continue;
        }
        if (item.id === "email_retorno" && !EMAIL_VALIDO.test(valor)) {
          ignorados.push("email_retorno (e-mail inválido: peça de novo)");
          continue;
        }
        if (/^n[aã]o sabe/i.test(valor) && !NAO_SEI.test(ultimaDoUsuario(conversa))) {
          ignorados.push(`${item.id} (o usuário não disse que não sabe: pergunte)`);
          continue;
        }
        if (DADO_SENSIVEL.test(valor)) {
          ignorados.push(`${item.id} (dado sensível descartado)`);
          continue;
        }
        const anterior = conversa.campos[item.id];
        conversa.campos[item.id] = { valor, turno: anterior?.turno ?? turnoDeOrigem(conversa, valor) };
      }
      return { ...checklist(conversa), ignorados };
    }

    case "abrir_chamado": {
      const categoria = categoriaPorId(conversa.categoria);
      if (!categoria) return { erro: "Chame classificar_chamado antes." };
      const pendentes = faltando(conversa);
      if (pendentes.length > 0) {
        return { erro: "Checklist incompleto. Pergunte o que falta.", faltando: pendentes.map((c) => c.rotulo) };
      }
      if (entrada.confirmado_pelo_usuario !== true || !CONFIRMACAO.test(ultimaDoUsuario(conversa))) {
        return { erro: "Sem confirmação explícita. Mostre o resumo, pergunte se pode abrir e espere o usuário responder sim." };
      }
      if (conversa.ticketId) return { erro: `Chamado ${conversa.ticketId} já foi aberto nesta conversa.` };

      const campos = Object.fromEntries(Object.entries(conversa.campos).map(([k, v]) => [k, v.valor]));
      if (campos.email_retorno) {
        // Identificação coletada no fim da conversa vira o requerente do chamado.
        conversa.email = campos.email_retorno;
        conversa.contato = `${campos.nome ?? "Sem nome"} <${campos.email_retorno}>`;
      }
      const conhecidos = categoria.campos.filter((c) => !/^n[aã]o sabe/i.test(campos[c.id] ?? "")).length;
      const relato = conversa.transcript.filter((m) => m.de === "usuario").map((m) => m.texto).join(" ");
      const prioridade = calcularPrioridade(categoria.id, conversa.perfil, campos, relato);

      const resumo = String(entrada.resumo ?? "");
      let protocolo: string | undefined;
      if (supabaseConfigurado()) {
        const [impacto, urgencia] = SUGESTAO[prioridade.prioridade];
        try {
          protocolo = await gravarChamadoSupabase({
            municipio: conversa.conta ?? campos.municipio,
            tipo: TIPOS.has(String(entrada.tipo_sugerido)) ? String(entrada.tipo_sugerido) : undefined,
            prazoInformado: dataValida(String(entrada.prazo_data ?? "")),
            requerente: conversa.contato,
            canal: conversa.canal,
            perfil: conversa.perfil,
            categoria: categoria.id,
            titulo: `${categoria.nome}: ${resumo.split(/(?<=[.!?])\s/)[0].slice(0, 120)}`,
            descricao: resumo,
            campos,
            impactoInformado: campos.impacto,
            impactoSugerido: impacto,
            urgenciaSugerida: urgencia,
            motivoSugestao: prioridade.motivo,
          });
        } catch (erro) {
          // O atendimento não pode travar por falha no banco: abre com protocolo local e registra o erro.
          console.error("[supabase] falha ao gravar chamado", erro);
        }
      }

      const ticket: Ticket = {
        id: protocolo ?? proximoProtocolo(),
        conversaId: conversa.id,
        canal: conversa.canal,
        perfil: conversa.perfil,
        contato: conversa.contato,
        categoria: categoria.id,
        resumo,
        campos,
        completude: conhecidos / categoria.campos.length,
        // Campos que não vieram na 1ª mensagem: cada um seria um pedido de complemento depois da abertura.
        camposColetadosPeloAgente: Object.entries(conversa.campos).filter(([, v]) => v.turno > 1 && !/^n[aã]o sabe/i.test(v.valor)).map(([k]) => k),
        prioridade: prioridade.prioridade,
        motivoPrioridade: prioridade.motivo,
        slaHoras: prioridade.slaHoras,
        prazo: prioridade.prazo.toISOString(),
        criadoEm: agora(),
        minutosParaAbrir: Math.max(0, Math.round((Date.now() - new Date(conversa.criadaEm).getTime()) / 60000)),
        status: "novo",
        precisouComplemento: null,
      };
      gravarTicket(ticket);
      conversa.ticketId = ticket.id;
      conversa.status = "ticket_aberto";

      return {
        protocolo: ticket.id,
        prioridade: ticket.prioridade,
        prazo_atendimento: prioridade.prazo.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
        orientacao: conversa.email
          ? `Informe protocolo e prazo. Diga que o retorno chega no e-mail ${conversa.email}.`
          : "Informe protocolo e prazo. Diga que o acompanhamento chega por este mesmo canal.",
      };
    }

    default:
      return { erro: `ferramenta desconhecida: ${nome}` };
  }
}

export { checklist };
