import { escolherOpcao, PERFIS, PRIORIDADES } from "./catalogo";
import { classificarProblema } from "./interpretacao";
import { listarContas, supabaseConfigurado } from "./supabase";
import { abrirChamado, type ChamadoAberto } from "./tools";
import type { Conversa } from "./types";

// Roteiro fixo do bot, conduzido pelo código:
//   nome → funcionário ou proponente → prefeitura (lista para funcionário; cidade para proponente)
//   → descrição livre → texto sugerido → ticket registrado.
// O modelo só lê a descrição e devolve título e prioridade (lib/interpretacao.ts).

export interface Resposta {
  textos: string[];
  /** Respostas rápidas exibidas como botões no chat. */
  opcoes?: string[];
}

export interface EntradaUsuario {
  texto: string;
  imagem?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
}

export const BOAS_VINDAS = "Olá! Sou o assistente de suporte PREFtech. Vou abrir um chamado para você.\nQual é o seu nome?";

/** Descrição com menos palavras que isso recebe um "me conte mais" (uma vez). */
const MINIMO_PALAVRAS_DESCRICAO = 12;

export async function conduzir(conversa: Conversa, entrada: EntradaUsuario): Promise<Resposta> {
  const fluxo = (conversa.fluxo ??= { etapa: "nome", dados: {} });
  const d = fluxo.dados;
  const texto = entrada.texto.trim();

  switch (fluxo.etapa) {
    case "nome": {
      const nome = texto.replace(/^(meu nome (é|e)|me chamo|sou o|sou a)\s+/i, "").trim();
      if (!/\p{L}{2,}/u.test(nome)) return { textos: ["Qual é o seu nome?"] };
      d.nome = nome;
      conversa.contato = nome;
      return perguntarPerfil(conversa, `Obrigado, ${primeiroNome(nome)}!`);
    }

    case "perfil": {
      const i = escolherOpcao(texto, PERFIS) ?? (/funcion|servidor|prefeitura|analista/i.test(texto) ? 0 : /propon|requerente|cidad|engenheir|arquitet/i.test(texto) ? 1 : null);
      if (i === null) return { textos: ["Você é funcionário da prefeitura ou proponente?"], opcoes: [...PERFIS] };
      conversa.perfil = i === 0 ? "analista_prefeitura" : "municipe";

      // Site de prefeitura que instalou o widget com data-conta: a prefeitura já é conhecida.
      if (conversa.conta) {
        d.conta = conversa.conta;
        return perguntarDescricao(conversa);
      }
      fluxo.etapa = "prefeitura";
      // Funcionário escolhe a prefeitura na lista; proponente informa a cidade do processo.
      if (conversa.perfil === "analista_prefeitura") {
        return { textos: ["De qual prefeitura você é?"], opcoes: await prefeituras() };
      }
      return { textos: ["De qual cidade é o seu processo?"] };
    }

    case "prefeitura": {
      const contas = await prefeituras();
      const i = escolherOpcao(texto, contas);
      const conta = i !== null ? contas[i] : texto.replace(/^prefeitura de /i, "").trim();
      // Resposta negativa ou vaga ("não sou", "não sei") não vira nome de cidade.
      if (!/\p{L}{2,}/u.test(conta) || /^(n[aã]o|nenhum|nenhuma|sei la)\b/i.test(conta)) {
        return conversa.perfil === "analista_prefeitura"
          ? { textos: ["De qual prefeitura você é?"], opcoes: contas }
          : { textos: ["De qual cidade é o seu processo?"] };
      }
      d.conta = conta;
      return perguntarDescricao(conversa);
    }

    case "descricao": {
      const palavras = texto.split(/\s+/).filter(Boolean).length;
      if (!d.pediuMais && palavras < MINIMO_PALAVRAS_DESCRICAO) {
        d.pediuMais = true;
        d.descricao = texto;
        return { textos: ["Me conte mais sobre o problema: o que você estava fazendo, o que aparece na tela e desde quando acontece."] };
      }
      d.descricao = d.descricao ? `${d.descricao}\n${texto}` : texto;
      return sugerirTexto(conversa);
    }

    case "revisao": {
      const c = d.classificacao!;
      const escolha = escolherOpcao(texto, OPCOES_REVISAO);
      if (escolha === 0) return registrar(conversa, c.textoSugerido!, d.descricao);
      if (escolha === 1) return registrar(conversa, d.descricao!);
      if (escolha === 2) {
        fluxo.etapa = "complemento";
        return { textos: [`Escreva o que quer acrescentar${c.faltando.length ? ` (por exemplo: ${c.faltando.join("; ").toLowerCase()})` : ""}:`] };
      }
      // Texto livre em vez de botão: vale como complemento do relato.
      d.descricao = `${d.descricao}\n${texto}`;
      return sugerirTexto(conversa);
    }

    case "complemento": {
      d.descricao = `${d.descricao}\n${texto}`;
      return sugerirTexto(conversa);
    }

    default:
      return { textos: ['Este atendimento já foi encerrado. Clique em "Novo atendimento" para abrir outro chamado.'] };
  }
}

const OPCOES_REVISAO = ["Usar o texto sugerido", "Manter o meu texto", "Quero completar"];

/**
 * O modelo organiza o relato e aponta o que falta. O usuário aprova o texto antes de ele ir para o ticket.
 * Sem modelo (ou se ele falhar), registra direto com o texto original.
 */
async function sugerirTexto(conversa: Conversa): Promise<Resposta> {
  const fluxo = conversa.fluxo!;
  const d = fluxo.dados;
  const perfil = conversa.perfil === "analista_prefeitura" ? "funcionário da prefeitura" : "proponente";
  d.classificacao = await classificarProblema(d.descricao!, perfil);
  if (!d.classificacao.textoSugerido) return registrar(conversa, d.descricao!);

  fluxo.etapa = "revisao";
  const falta = d.classificacao.faltando.length
    ? `\n\nPara o suporte resolver mais rápido, ainda faltaria:\n${d.classificacao.faltando.map((f) => `• ${f}`).join("\n")}`
    : "";
  return {
    textos: [
      `Organizei o seu relato para o time de suporte entender mais rápido:\n\n${d.classificacao.textoSugerido}${falta}`,
      "Posso usar este texto no chamado?",
    ],
    opcoes: OPCOES_REVISAO,
  };
}

async function registrar(conversa: Conversa, descricao: string, relatoOriginal?: string): Promise<Resposta> {
  const fluxo = conversa.fluxo!;
  const d = fluxo.dados;
  const c = d.classificacao!;
  const resultado = await abrirChamado(conversa, {
    nome: d.nome!,
    conta: d.conta!,
    titulo: c.titulo,
    descricao,
    relatoOriginal,
    prioridade: c.prioridade,
    motivo: c.motivo,
  });
  fluxo.etapa = "encerrado";
  return { textos: [mensagemDoResultado(resultado, c.titulo)] };
}

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}

async function prefeituras(): Promise<string[]> {
  return supabaseConfigurado() ? listarContas() : [];
}

function perguntarDescricao(conversa: Conversa): Resposta {
  conversa.fluxo!.etapa = "descricao";
  return { textos: ["Descreva o problema que está ocorrendo:"] };
}

function perguntarPerfil(conversa: Conversa, prefixo?: string): Resposta {
  conversa.fluxo!.etapa = "perfil";
  return { textos: [[prefixo, "Você é funcionário da prefeitura ou proponente?"].filter(Boolean).join(" ")], opcoes: [...PERFIS] };
}

/** O que aconteceu com o chamado no fluxo do Supabase, contado ao usuário. */
function mensagemDoResultado(r: ChamadoAberto, titulo: string): string {
  const prioridade = r.prioridade as keyof typeof PRIORIDADES | null;
  return [
    "✅ Ticket registrado!",
    `Número: ${r.protocolo}`,
    `Título: ${titulo}`,
    prioridade ? `Prioridade: ${prioridade} (${PRIORIDADES[prioridade].nome})` : null,
    r.pai ? `Já havia um chamado aberto sobre o mesmo problema (${r.pai}): o seu foi vinculado a ele.` : null,
    r.revisarP1 ? "A sua prefeitura já está no limite de chamados críticos: um gestor vai confirmar a prioridade." : null,
    "O time de suporte foi notificado.",
  ]
    .filter(Boolean)
    .join("\n");
}
