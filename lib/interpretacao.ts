import fs from "fs";
import path from "path";
import { z } from "zod";
import { PRIORIDADES, prioridadePorRegras, type CodigoPrioridade } from "./catalogo";
import { interpretarJSON } from "./llm";

// O modelo lê a descrição livre e devolve título e prioridade. O roteiro e o registro são código (lib/fluxo.ts).
// O prompt de sistema é o INSTRUCTIONS.md da raiz, sem alterações.
const SISTEMA = fs.readFileSync(path.join(process.cwd(), "INSTRUCTIONS.md"), "utf8");

const Classificacao = z.object({
  titulo: z.string().min(5).max(120),
  prioridade: z.enum(["P1", "P2", "P3", "P4"]),
  motivo: z.string().max(200),
});

export interface ResultadoClassificacao {
  titulo: string;
  prioridade: CodigoPrioridade;
  motivo: string;
  porModelo: boolean;
}

export async function classificarProblema(descricao: string, perfil: string): Promise<ResultadoClassificacao> {
  const tarefa = `TAREFA: classificar_chamado

Quem escreve: ${perfil}

Prioridades:
${Object.entries(PRIORIDADES)
  .map(([codigo, p]) => `- ${codigo} (${p.nome}): ${p.regra}`)
  .join("\n")}

Descrição escrita pelo usuário:
"""
${descricao}
"""

Responda só com JSON: {"titulo": "<título>", "prioridade": "P1" | "P2" | "P3" | "P4", "motivo": "<uma frase>"}`;

  const r = await interpretarJSON(SISTEMA, tarefa, Classificacao);
  if (r) return { titulo: r.titulo.trim().replace(/[.!]+$/, ""), prioridade: r.prioridade, motivo: r.motivo, porModelo: true };

  const primeira = descricao.trim().split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
  return {
    titulo: primeira.length > 90 ? `${primeira.slice(0, 87)}…` : primeira,
    prioridade: prioridadePorRegras(descricao),
    motivo: "classificado por palavras-chave da descrição",
    porModelo: false,
  };
}
