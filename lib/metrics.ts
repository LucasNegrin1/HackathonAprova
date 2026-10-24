import baseline from "@/data/baseline.json";
import { categoriaPorId } from "./catalogo";
import { listarConversas, listarTickets } from "./store";

export interface Metricas {
  conversas: number;
  resolvidasSemTicket: number;
  taxaDeflexao: number | null;
  ticketsAbertos: number;
  completudeMedia: number | null;
  complementosEvitados: number;
  complementosEvitadosPorTicket: number | null;
  avaliados: number;
  resolvidosPrimeiraAnalise: number | null;
  minutosMediosParaAbrir: number | null;
  porCategoria: { categoria: string; tickets: number; deflexoes: number }[];
  baseline: typeof baseline;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function calcularMetricas(): Metricas {
  const finalizadas = listarConversas().filter((c) => c.status !== "em_atendimento");
  const resolvidas = finalizadas.filter((c) => c.status === "resolvida_autoatendimento");
  const tickets = listarTickets();
  const avaliados = tickets.filter((t) => t.precisouComplemento !== null);
  const complementos = tickets.reduce((s, t) => s + t.camposColetadosPeloAgente.length, 0);

  const categoriasUsadas = new Set([...tickets.map((t) => t.categoria), ...resolvidas.map((c) => c.categoria ?? "")]);
  const porCategoria = [...categoriasUsadas]
    .filter(Boolean)
    .map((id) => ({
      categoria: categoriaPorId(id)?.nome ?? id,
      tickets: tickets.filter((t) => t.categoria === id).length,
      deflexoes: resolvidas.filter((c) => c.categoria === id).length,
    }));

  return {
    conversas: finalizadas.length,
    resolvidasSemTicket: resolvidas.length,
    taxaDeflexao: finalizadas.length ? resolvidas.length / finalizadas.length : null,
    ticketsAbertos: tickets.length,
    completudeMedia: media(tickets.map((t) => t.completude)),
    complementosEvitados: complementos,
    complementosEvitadosPorTicket: tickets.length ? complementos / tickets.length : null,
    avaliados: avaliados.length,
    resolvidosPrimeiraAnalise: avaliados.length ? avaliados.filter((t) => !t.precisouComplemento).length / avaliados.length : null,
    minutosMediosParaAbrir: media(tickets.map((t) => t.minutosParaAbrir)),
    porCategoria,
    baseline,
  };
}
