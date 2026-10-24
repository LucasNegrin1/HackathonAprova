import { categoriaPorId, normalizar } from "./catalogo";
import { dataIso, extrairIdentificadores } from "./extracao";
import { calcularPrioridade } from "./priority";
import { proximoProtocolo } from "./store";
import { gravarChamadoSupabase, supabaseConfigurado, type ResultadoChamado } from "./supabase";
import type { Campo, Conversa, Perfil } from "./types";

// Operações do chamado usadas pelo fluxo (lib/fluxo.ts). As regras que precisam ser garantidas
// moram aqui: validação do que é registrado e abertura só com checklist completo e confirmado.

// "não sabe" só vale se o usuário disse que não sabe; abrir chamado exige um "sim" do usuário.
export const NAO_SEI = /\b(nao sei|nao lembro|nao tenho|nao sabe|sei la|desconheco|nao faco ideia)\b/;
export const CONFIRMACAO = /^(sim|s|pode|pode abrir|pode sim|confirmo|confirmado|ok|isso|correto|certo|tudo certo|esta certo|claro|positivo)\b/;

export function ultimaDoUsuario(conversa: Conversa): string {
  return normalizar(conversa.transcript.filter((m) => m.de === "usuario").at(-1)?.texto ?? "");
}

// Respostas negativas ("não tem", "nenhum") são respostas válidas à pergunta feita.
export const NEGATIVA = /^(nao tem|nao ha|nao existe|nao possui|nenhum|nenhuma|sem)\b/;

// Valores de preenchimento que o modelo às vezes devolve no lugar de "não informado".
const VAZIO = /^(indefinid[oa]|nao informad[oa]|desconhecid[oa]|n\/?a|null|none|-+|\?+)$/;

// Pedidos de senha/código não devem ser guardados no ticket.
const DADO_SENSIVEL = /(senha|password|c[oó]digo de verifica|cvv|cart[aã]o)\s*[:=]?\s*\S+/i;

// Ninguém se identifica para conversar. Nome e e-mail só são pedidos quando
// for abrir chamado, por isso ficam no fim do checklist (depois dos dados do problema).
const IDENTIFICACAO: Campo[] = [
  { id: "nome", rotulo: "Nome", pergunta_amigavel: "Para registrar o chamado, qual é o seu nome?" },
  { id: "email_retorno", rotulo: "E-mail para retorno", pergunta_amigavel: "Em qual e-mail você quer receber o retorno do suporte?" },
];
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checklist da conversa: campos da categoria e a identificação do requerente. */
export function camposDe(conversa: Conversa): Campo[] {
  const categoria = categoriaPorId(conversa.categoria);
  return categoria ? [...categoria.campos, ...IDENTIFICACAO] : [];
}

export function faltando(conversa: Conversa): Campo[] {
  return camposDe(conversa).filter((c) => !conversa.campos[c.id]?.valor?.trim());
}

/**
 * Em que mensagem do usuário o dado apareceu pela primeira vez. Se o valor já estava escrito
 * no relato inicial, ele não conta como complemento evitado.
 */
function turnoDeOrigem(conversa: Conversa, valor: string): number {
  const alvo = normalizar(valor);
  const mensagens = conversa.transcript.filter((m) => m.de === "usuario");
  const indice = alvo.length >= 3 ? mensagens.findIndex((m) => normalizar(m.texto).includes(alvo)) : -1;
  return indice >= 0 ? indice + 1 : conversa.turnosUsuario;
}

/** Define a categoria e o perfil; identificadores já escritos pelo usuário entram sozinhos. */
export function classificar(conversa: Conversa, categoriaId: string, perfil: Perfil) {
  const categoria = categoriaPorId(categoriaId);
  if (!categoria) throw new Error(`categoria desconhecida: ${categoriaId}`);
  conversa.categoria = categoria.id;
  conversa.perfil = perfil;
  const validos = new Set(camposDe(conversa).map((c) => c.id));
  for (const id of Object.keys(conversa.campos)) if (!validos.has(id)) delete conversa.campos[id];
  for (const m of conversa.transcript.filter((t) => t.de === "usuario")) {
    for (const { id, valor } of extrairIdentificadores(m.texto)) {
      if (validos.has(id) && !conversa.campos[id]) conversa.campos[id] = { valor, turno: turnoDeOrigem(conversa, valor) };
    }
  }
}

/** Registra valores do checklist com as validações. Devolve os ids recusados e o motivo. */
export function registrar(conversa: Conversa, itens: { id: string; valor: string }[]): string[] {
  const validos = new Set(camposDe(conversa).map((c) => c.id));
  const recusados: string[] = [];
  for (const item of itens) {
    let valor = item.valor?.trim();
    if (!validos.has(item.id) || !valor || VAZIO.test(normalizar(valor))) continue;
    if (/^n[aã]o sabe/i.test(valor) || NAO_SEI.test(normalizar(valor))) {
      if (!NAO_SEI.test(ultimaDoUsuario(conversa))) continue; // o usuário não disse que não sabe
      valor = "não sabe";
    }
    if (item.id === "email_retorno") {
      const email = valor.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
      if (!email || !EMAIL_VALIDO.test(email)) {
        recusados.push("email_retorno");
        continue;
      }
      valor = email;
    }
    if (DADO_SENSIVEL.test(valor)) {
      recusados.push(item.id);
      continue;
    }
    const anterior = conversa.campos[item.id];
    conversa.campos[item.id] = { valor, turno: anterior?.turno ?? turnoDeOrigem(conversa, valor) };
  }
  return recusados;
}

// Sugestão de impacto × urgência para a triagem, a partir da regra de prioridade (lib/priority.ts).
const SUGESTAO: Record<string, [number, number]> = { urgente: [3, 3], alta: [3, 2], media: [2, 2], baixa: [1, 2] };

export interface ChamadoAberto extends ResultadoChamado {
  local: boolean;
}

/** Abre o chamado. Só funciona com checklist completo e com o "sim" do usuário na última mensagem. */
export async function abrirChamado(conversa: Conversa, resumo: string, tipo: string): Promise<ChamadoAberto> {
  const categoria = categoriaPorId(conversa.categoria);
  if (!categoria) throw new Error("conversa sem categoria");
  if (faltando(conversa).length > 0) throw new Error("checklist incompleto");
  if (!CONFIRMACAO.test(ultimaDoUsuario(conversa))) throw new Error("sem confirmação do usuário");
  if (conversa.ticketId) throw new Error(`chamado ${conversa.ticketId} já aberto`);

  const campos = Object.fromEntries(Object.entries(conversa.campos).map(([k, v]) => [k, v.valor]));
  conversa.email = campos.email_retorno;
  conversa.contato = `${campos.nome} <${campos.email_retorno}>`;

  const relato = conversa.transcript.filter((m) => m.de === "usuario").map((m) => m.texto).join(" ");
  const prioridade = calcularPrioridade(categoria.id, conversa.perfil, campos, relato);
  const [impacto, urgencia] = SUGESTAO[prioridade.prioridade];

  let resultado: ChamadoAberto | undefined;
  if (supabaseConfigurado()) {
    try {
      resultado = {
        local: false,
        ...(await gravarChamadoSupabase({
          municipio: conversa.conta ?? campos.municipio,
          tipo,
          prazoInformado: dataIso(campos.prazo) || undefined,
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
        })),
      };
    } catch (erro) {
      // O atendimento não pode travar por falha no banco: registra o erro e devolve um protocolo local.
      console.error("[supabase] falha ao gravar chamado", erro);
    }
  }
  resultado ??= { local: true, protocolo: proximoProtocolo(), status: "aberto", prioridade: null, pai: null, revisarP1: false };

  conversa.ticketId = resultado.protocolo;
  conversa.status = "ticket_aberto";
  return resultado;
}
