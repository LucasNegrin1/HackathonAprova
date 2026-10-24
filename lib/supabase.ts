import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizar } from "./catalogo";

// Cliente do servidor com a chave secreta. O banco tem RLS sem políticas: o navegador nunca acessa direto.
let cliente: SupabaseClient | undefined;

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function supabase(): SupabaseClient {
  cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

/** Conta do município informado no checklist; cria a conta se ainda não existir. */
async function contaDoMunicipio(municipio: string | undefined): Promise<string> {
  const nome = municipio && !/^n[aã]o sabe/i.test(municipio) ? municipio.trim() : "Conta não identificada";
  const { data: contas, error } = await supabase().from("contas").select("id, nome");
  if (error) throw error;
  const alvo = normalizar(nome);
  const existente =
    contas.find((c) => normalizar(c.nome) === alvo) ?? contas.find((c) => normalizar(c.nome).includes(alvo));
  if (existente) return existente.id;

  const { data, error: erroInsert } = await supabase()
    .from("contas")
    .insert({ nome: nome === "Conta não identificada" ? nome : `Prefeitura de ${nome}` })
    .select("id")
    .single();
  if (erroInsert) throw erroInsert;
  return data.id;
}

export interface NovoChamado {
  municipio?: string;
  requerente: string;
  canal: string;
  perfil: string;
  categoria: string;
  titulo: string;
  descricao: string;
  campos: Record<string, string>;
  impactoInformado?: string;
  /** Tipo sugerido pelo agente; a triagem confirma ou troca. */
  tipo?: string;
  prazoInformado?: string;
  impactoSugerido: number;
  urgenciaSugerida: number;
  motivoSugestao: string;
}

/** Grava o chamado com status "aberto" (aguardando triagem) e devolve o protocolo gerado pelo banco. */
export async function gravarChamadoSupabase(c: NovoChamado): Promise<string> {
  const { data, error } = await supabase()
    .from("chamados")
    .insert({
      conta_id: await contaDoMunicipio(c.municipio),
      requerente: c.requerente,
      canal: c.canal,
      perfil: c.perfil,
      categoria: c.categoria,
      titulo: c.titulo,
      descricao: c.descricao,
      campos: c.campos,
      impacto_informado: c.impactoInformado ?? null,
      prazo_informado: c.prazoInformado ?? null,
      tipo: c.tipo ?? null,
      impacto_sugerido: c.impactoSugerido,
      urgencia_sugerida: c.urgenciaSugerida,
      motivo_sugestao: c.motivoSugestao,
    })
    .select("protocolo")
    .single();
  if (error) throw error;
  return data.protocolo;
}

