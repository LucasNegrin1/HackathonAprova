import { artigos, normalizar } from "./catalogo";
import type { Artigo } from "./types";

export interface ResultadoBusca {
  artigo: Artigo;
  pontos: number;
}

const PALAVRAS_VAZIAS = new Set(["a", "o", "e", "de", "do", "da", "que", "um", "uma", "no", "na", "meu", "minha", "nao", "com", "para", "por", "se", "eu"]);

/**
 * Busca clássica por palavras-chave: frase-chave encontrada vale 3, palavra do título vale 1.
 * Determinística e auditável. O agente só escolhe se usa ou não o resultado.
 */
export function buscarArtigos(consulta: string, limite = 3): ResultadoBusca[] {
  const texto = ` ${normalizar(consulta)} `;
  const tokens = new Set(texto.split(" ").filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t)));

  return artigos
    .map((artigo) => {
      let pontos = 0;
      for (const chave of artigo.palavras_chave) {
        if (texto.includes(` ${normalizar(chave)}`)) pontos += 3;
      }
      for (const palavra of normalizar(artigo.titulo).split(" ")) {
        if (tokens.has(palavra)) pontos += 1;
      }
      return { artigo, pontos };
    })
    .filter((r) => r.pontos >= 3)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite);
}
