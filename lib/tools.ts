import { PRIORIDADES, type CodigoPrioridade } from "./catalogo";
import { proximoProtocolo } from "./store";
import { gravarChamadoSupabase, supabaseConfigurado, type ResultadoChamado } from "./supabase";
import type { Conversa } from "./types";

// Registro do chamado. Só registra com todos os dados do roteiro preenchidos.

export interface DadosChamado {
  nome: string;
  conta: string;
  titulo: string;
  descricao: string;
  /** Relato como o usuário escreveu, guardado quando ele aprova o texto sugerido. */
  relatoOriginal?: string;
  prioridade: CodigoPrioridade;
  motivo: string;
}

export interface ChamadoAberto extends ResultadoChamado {
  local: boolean;
}

export async function abrirChamado(conversa: Conversa, d: DadosChamado): Promise<ChamadoAberto> {
  const faltando = Object.entries(d).filter(([k, v]) => k !== "relatoOriginal" && !v);
  if (faltando.length) throw new Error(`dados incompletos: ${faltando.map(([k]) => k).join(", ")}`);
  if (conversa.ticketId) throw new Error(`chamado ${conversa.ticketId} já aberto`);

  const regra = PRIORIDADES[d.prioridade];
  let resultado: ChamadoAberto | undefined;
  if (supabaseConfigurado()) {
    try {
      resultado = {
        local: false,
        ...(await gravarChamadoSupabase({
          conta: d.conta,
          requerente: d.nome,
          canal: conversa.canal,
          perfil: conversa.perfil,
          categoria: "Bot de atendimento",
          titulo: d.titulo,
          descricao: d.descricao,
          campos: { prioridade_bot: d.prioridade, motivo: d.motivo, ...(d.relatoOriginal ? { relato_original: d.relatoOriginal } : {}) },
          tipo: regra.tipo,
          impactoSugerido: regra.impacto,
          urgenciaSugerida: regra.urgencia,
          motivoSugestao: `${d.prioridade} (${regra.nome}): ${d.motivo}`,
        })),
      };
    } catch (erro) {
      // O atendimento não pode travar por falha no banco: registra o erro e devolve um protocolo local.
      console.error("[supabase] falha ao gravar chamado", erro);
    }
  }
  resultado ??= { local: true, protocolo: proximoProtocolo(), status: "aberto", prioridade: d.prioridade, pai: null, revisarP1: false };

  conversa.ticketId = resultado.protocolo;
  conversa.status = "ticket_aberto";
  return resultado;
}
