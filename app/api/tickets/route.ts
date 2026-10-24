import { connection } from "next/server";
import { calcularMetricas } from "@/lib/metrics";
import { buscarConversa, buscarTicket, limparTudo, listarTickets, salvar } from "@/lib/store";
import type { StatusTicket } from "@/lib/types";

export async function GET() {
  await connection(); // dados mudam a cada requisição: não pré-renderizar
  const tickets = listarTickets().map((t) => ({ ...t, transcript: buscarConversa(t.conversaId)?.transcript ?? [] }));
  return Response.json({ tickets, metricas: calcularMetricas() });
}

/** Avaliação do analista de suporte: status e se precisou pedir complemento. */
export async function PATCH(request: Request) {
  const { id, status, precisouComplemento } = (await request.json()) as {
    id: string;
    status?: StatusTicket;
    precisouComplemento?: boolean;
  };
  const ticket = buscarTicket(id);
  if (!ticket) return Response.json({ erro: "ticket não encontrado" }, { status: 404 });
  if (status) ticket.status = status;
  if (typeof precisouComplemento === "boolean") ticket.precisouComplemento = precisouComplemento;
  salvar();
  return Response.json({ ok: true });
}

export async function DELETE() {
  limparTudo();
  return Response.json({ ok: true });
}
