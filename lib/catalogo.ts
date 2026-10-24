import categoriasJson from "@/data/categorias.json";
import baseJson from "@/data/base-conhecimento.json";
import type { Artigo, Campo, Categoria } from "./types";

// Primeira etapa do fluxo: o cliente informa impacto e prazo. Valem para toda categoria.
const CAMPOS_COMUNS: Campo[] = [
  {
    id: "impacto",
    rotulo: "Impacto",
    pergunta_amigavel: "Isso afeta só você ou outras pessoas? Está impedindo algum atendimento ou trabalho?",
  },
  {
    id: "prazo",
    rotulo: "Prazo",
    pergunta_amigavel: "Até quando você precisa disso resolvido? Tem alguma data limite, como vencimento de taxa ou prazo legal?",
  },
];

export const categorias: Categoria[] = (categoriasJson as Categoria[]).map((c) => ({
  ...c,
  campos: [...c.campos, ...CAMPOS_COMUNS.filter((comum) => !c.campos.some((f) => f.id === comum.id))],
}));
export const artigos = baseJson as Artigo[];

export function categoriaPorId(id: string | undefined): Categoria | undefined {
  return categorias.find((c) => c.id === id);
}

/** Minúsculas e sem acento, para comparar texto livre com palavras-chave. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9./ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
