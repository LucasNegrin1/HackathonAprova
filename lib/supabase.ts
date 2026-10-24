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

/**
 * Grava o chamado e já o tria pelas regras do banco (triar_chamado), com a sugestão do agente.
 * Não há etapa manual de triagem: o chamado entra direto na fila do painel PrefTech
 * (ou no backlog de produto, se for sugestão ou parametrização). Devolve o protocolo gerado pelo banco.
 */
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
    .select("id, protocolo")
    .single();
  if (error) throw error;

  await triarAutomatico(data.id, c);
  return data.protocolo;
}

/**
 * Triagem automática com impacto × urgência sugeridos pelo agente. Se a conta já estiver na cota de P1,
 * o banco recusa (COTA_P1_EXCEDIDA): o chamado entra como P1 com justificativa, e o painel mostra
 * em "Revisão do gestor" para alguém decidir se mantém ou rebaixa.
 */
async function triarAutomatico(id: string, c: NovoChamado) {
  const params = {
    p_id: id,
    p_tipo: c.tipo ?? "problema",
    p_impacto: c.impactoSugerido,
    p_urgencia: c.urgenciaSugerida,
    p_autor: "bot de atendimento",
  };
  let { error } = await supabase().rpc("triar_chamado", params);
  if (error?.message === "COTA_P1_EXCEDIDA") {
    ({ error } = await supabase().rpc("triar_chamado", {
      ...params,
      p_justificativa_p1: `Classificado como P1 pelo bot acima da cota da conta (${c.motivoSugestao}). Revisar: manter ou rebaixar.`,
    }));
  }
  // Se a triagem falhar, o chamado continua gravado como "aberto" e o erro fica no log.
  if (error) console.error("[supabase] triagem automática falhou", error);
}

