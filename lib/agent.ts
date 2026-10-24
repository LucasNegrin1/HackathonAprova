import { conduzir, type EntradaUsuario, type Resposta } from "./fluxo";
import { agora, salvar } from "./store";
import type { Conversa } from "./types";

export type { EntradaUsuario, Resposta };

/** Processa uma mensagem do usuário: registra no histórico, conduz o fluxo e salva a conversa. */
export async function responder(conversa: Conversa, entrada: EntradaUsuario): Promise<Resposta> {
  conversa.turnosUsuario += 1;
  conversa.transcript.push({ de: "usuario", texto: entrada.texto, imagem: !!entrada.imagem, em: agora() });

  const resposta = await conduzir(conversa, entrada);

  for (const texto of resposta.textos) conversa.transcript.push({ de: "agente", texto, em: agora() });
  conversa.atualizadaEm = agora();
  salvar();
  return resposta;
}
