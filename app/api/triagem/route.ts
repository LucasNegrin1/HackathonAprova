import { connection } from "next/server";
import { supabaseConfigurado } from "@/lib/supabase";
import { executarAcao, visaoTriagem, type AcaoTriagem } from "@/lib/triagem";

export async function GET() {
  await connection();
  if (!supabaseConfigurado()) return Response.json({ configurado: false });
  try {
    return Response.json({ configurado: true, ...(await visaoTriagem()) });
  } catch (erro) {
    console.error("[triagem]", erro);
    return Response.json({ configurado: true, erro: "Falha ao ler o Supabase" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!supabaseConfigurado()) return Response.json({ erro: "Supabase não configurado" }, { status: 503 });
  const { error, data } = await executarAcao((await request.json()) as AcaoTriagem);
  if (error) {
    // Regras do banco voltam como erro de negócio para o painel (ex.: cota de P1 excedida).
    const cota = error.message === "COTA_P1_EXCEDIDA";
    return Response.json({ erro: error.message, detalhe: error.details, dica: error.hint, cota }, { status: cota ? 409 : 400 });
  }
  return Response.json({ ok: true, data });
}
