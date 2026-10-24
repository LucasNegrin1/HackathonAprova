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

export interface ResultadoChamado {
  protocolo: string;
  status: string;
  prioridade: string | null;
  /** Protocolo do chamado-pai quando o novo foi vinculado a um parecido já aberto. */
  pai: string | null;
  /** P1 acima da cota da conta: um gestor confirma a prioridade. */
  revisarP1: boolean;
}

/**
 * Grava o chamado e o passa pelo fluxo de triagem do banco (triar_chamado), na ordem do fluxo:
 * 1. sugestão ou nova parametrização → backlog de produto;
 * 2. parecido com um chamado aberto → vinculado ao chamado-pai (o volume do grupo soma ao impacto);
 * 3. senão, impacto × urgência sugeridos pelo bot → P1 a P4, respeitando a cota de P1 da conta.
 */
export async function gravarChamadoSupabase(c: NovoChamado): Promise<ResultadoChamado> {
  const contaId = await contaDoMunicipio(c.municipio);
  const { data, error } = await supabase()
    .from("chamados")
    .insert({
      conta_id: contaId,
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

  const vaiParaBacklog = c.tipo === "sugestao" || c.tipo === "parametrizacao";
  const pai = vaiParaBacklog ? null : await chamadoParecido(data.id, contaId, c);
  await triar(data.id, c, pai?.id ?? null);

  const { data: final, error: erroLeitura } = await supabase()
    .from("chamados")
    .select("protocolo, status, prioridade, justificativa_p1, pai:chamado_pai_id(protocolo)")
    .eq("id", data.id)
    .single();
  if (erroLeitura) throw erroLeitura;
  const lido = final as unknown as { protocolo: string; status: string; prioridade: string | null; justificativa_p1: string | null; pai: { protocolo: string } | null };
  return { protocolo: lido.protocolo, status: lido.status, prioridade: lido.prioridade, pai: lido.pai?.protocolo ?? null, revisarP1: Boolean(lido.justificativa_p1) };
}

const GENERICAS = new Set([
  "para", "como", "pois", "esta", "sobre", "mais", "quando", "onde", "isso", "esse", "essa", "favor", "obrigado", "obrigada",
  "processo", "processos", "sistema", "aprova", "prefeitura", "solicito", "solicitacao", "preciso", "gostaria", "estamos", "temos",
  "erro", "problema", "categoria", "dados", "coletados", "artigos",
]);

function palavras(texto: string) {
  return new Set(normalizar(texto).split(" ").filter((p) => p.length > 3 && !GENERICAS.has(p)));
}

/**
 * "Parecido com um chamado aberto?": mesma categoria, na fila e sem pai; palavras relevantes em comum
 * no título e no começo da descrição. A mesma conta desempata. Exige semelhança alta para vincular sozinho.
 */
async function chamadoParecido(id: string, contaId: string, c: NovoChamado): Promise<{ id: string } | null> {
  const { data, error } = await supabase()
    .from("chamados")
    .select("id, titulo, descricao, conta_id")
    .eq("categoria", c.categoria)
    .in("status", ["na_fila", "em_atendimento", "aguardando_cliente"])
    .is("chamado_pai_id", null)
    .neq("id", id);
  if (error) throw error;

  const titulo = palavras(c.titulo);
  const corpo = palavras(c.descricao.slice(0, 400));
  const melhor = data
    .map((o) => {
      const noTitulo = [...palavras(o.titulo)].filter((p) => titulo.has(p)).length;
      const noCorpo = [...palavras((o.descricao ?? "").slice(0, 400))].filter((p) => corpo.has(p)).length;
      return { id: o.id as string, noTitulo, pontos: 2 * noTitulo + noCorpo + (o.conta_id === contaId ? 1 : 0) };
    })
    .filter((r) => r.noTitulo >= 2 && r.pontos >= 7)
    .sort((a, b) => b.pontos - a.pontos)[0];
  return melhor ? { id: melhor.id } : null;
}

/**
 * Triagem pelas regras do banco. Se a conta já estiver na cota de P1, o banco recusa (COTA_P1_EXCEDIDA):
 * o chamado entra como P1 com justificativa e o painel mostra em "Revisão do gestor".
 */
async function triar(id: string, c: NovoChamado, paiId: string | null) {
  const params = {
    p_id: id,
    p_tipo: c.tipo ?? "problema",
    p_impacto: c.impactoSugerido,
    p_urgencia: c.urgenciaSugerida,
    p_chamado_pai: paiId,
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
