import { connection } from "next/server";
import { dadosGestao } from "@/lib/gestao";
import { supabaseConfigurado } from "@/lib/supabase";

/** Tickets e equipe para o painel gerencial PrefTech (/gestao), lidos do Supabase. */
export async function GET() {
  await connection();
  if (!supabaseConfigurado()) return Response.json({ erro: "Supabase não configurado" }, { status: 503 });
  try {
    return Response.json(await dadosGestao());
  } catch (erro) {
    console.error("[gestao]", erro);
    return Response.json({ erro: "Falha ao ler o Supabase" }, { status: 502 });
  }
}
