// Importa a planilha de tickets de exemplo para o Supabase, passando cada chamado pelas regras do banco.
// Uso: node --env-file=.env.local scripts/importar-planilha.mjs tickets_suporte_150_balanceado.xlsx
//
// Mapeamento (dados fictícios):
//   Categoria  → tipo: Nova parametrização → parametrizacao, Sugestões/Nova Funcionalidade → sugestao (ambos vão
//                ao backlog), Problema → problema, Ajuda → duvida, Ajustes → ajuste.
//   Prioridade → "Sem prioridade definida" fica aguardando triagem. Os números (1 a 9, 9 = mais crítico) viram
//                impacto × urgência e passam por triar_chamado(), que calcula P1..P4 e aplica a cota de P1.
//   A planilha não tem data de última movimentação: geramos uma, determinística, para a demo de chamados parados.
import ExcelJS from "exceljs";

const TIPO = {
  "Nova parametrização": "parametrizacao",
  "Sugestões/Nova Funcionalidade": "sugestao",
  Problema: "problema",
  Ajuda: "duvida",
  Ajustes: "ajuste",
};

// Pontuação 1..9 → (impacto, urgência) da matriz: 9 → P1; 6–8 → P2; 3–5 → P3; 1–2 → P4.
function impactoUrgencia(nota) {
  if (nota >= 9) return [3, 3];
  if (nota >= 6) return [3, 2];
  if (nota >= 4) return [2, 2];
  if (nota === 3) return [3, 1];
  if (nota === 2) return [2, 1];
  return [1, 1];
}

const EQUIPE = ["Carlos Albuquerque", "Mariana Duarte", "Rafael Mendes", "Beatriz Fonseca", "Lucas Siqueira"];

function distribuir(numero, naFila) {
  if (!naFila) return { responsavel: null, statusFinal: null };
  const faixa = numero % 10;
  if (faixa <= 5) return { responsavel: EQUIPE[numero % EQUIPE.length], statusFinal: "em_atendimento" };
  if (faixa === 6) return { responsavel: EQUIPE[(numero + 2) % EQUIPE.length], statusFinal: "aguardando_cliente" };
  return { responsavel: null, statusFinal: null };
}

const DIA = 86_400_000;
const agora = Date.now();
const limitar = (ms) => new Date(Math.min(ms, agora - 3_600_000)).toISOString();

function texto(v) {
  if (v == null) return null;
  if (typeof v === "object" && !(v instanceof Date)) return v.richText ? v.richText.map((t) => t.text).join("") : (v.text ?? v.result ?? null);
  return v;
}

const arquivo = process.argv[2];
if (!arquivo) throw new Error("Informe o arquivo .xlsx");
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(arquivo);
const ws = wb.worksheets[0];

const registros = [];
ws.eachRow((row, i) => {
  if (i === 1) return;
  const [numero, descricao, conta, categoria, prioridade, assunto, criado, primeira] = row.values.slice(1).map(texto);
  const tipo = TIPO[categoria];
  if (!tipo) throw new Error(`Categoria desconhecida na linha ${i}: ${categoria}`);
  const nota = typeof prioridade === "number" ? prioridade : null;
  const criadoMs = new Date(criado).getTime();
  const [impacto, urgencia] = nota ? impactoUrgencia(nota) : [null, null];
  registros.push({
    protocolo: String(numero),
    conta: conta || "Conta não identificada",
    assunto: assunto || null,
    titulo: String(descricao),
    descricao: typeof primeira === "string" && primeira.trim() ? primeira : null,
    tipo,
    triar: nota !== null,
    impacto,
    urgencia,
    justificativa: nota >= 9 ? `P1 herdado da planilha de origem (prioridade ${nota})` : null,
    criado: new Date(criadoMs).toISOString(),
    triado: limitar(criadoMs + DIA),
    // Última movimentação entre 0 e 13 dias atrás (nunca antes da abertura): ~20% da fila fica parada há mais de 10 dias.
    movimentacao: limitar(Math.max(criadoMs, agora - ((numero * 37) % 14) * DIA - 2 * 3_600_000)),
    // Distribuição fictícia na equipe do painel PrefTech: ~60% em atendimento, ~10% aguardando cliente, ~30% sem responsável.
    ...distribuir(numero, nota !== null && !["parametrizacao", "sugestao"].includes(tipo)),
    campos: { numero_original: String(numero), categoria_original: categoria, prioridade_original: prioridade ?? null, tipo_pergunta: assunto ?? null },
  });
});

const dados = JSON.stringify(registros).replaceAll("'", "''");
const sql = `
-- Reimportação idempotente: remove os chamados da planilha e as contas de exemplo antigas sem chamados.
delete from chamados where campos ? 'numero_original';
delete from contas c where c.nome like 'Prefeitura de %' and not exists (select 1 from chamados where conta_id = c.id);

do $$
declare
  r jsonb;
  v uuid;
begin
  for r in select * from jsonb_array_elements('${dados}'::jsonb) loop
    insert into chamados (protocolo, conta_id, canal, perfil, categoria, titulo, descricao, campos, tipo, criado_em)
    values (r->>'protocolo', (select id from contas where nome = r->>'conta'), 'pylon', 'analista_prefeitura',
            r->>'assunto', r->>'titulo', r->>'descricao', r->'campos', (r->>'tipo')::tipo_chamado, (r->>'criado')::timestamptz)
    returning id into v;

    if (r->>'triar')::boolean then
      perform triar_chamado(v, (r->>'tipo')::tipo_chamado, (r->>'impacto')::int, (r->>'urgencia')::int,
                            null, r->>'justificativa', 'importação da planilha');
      update chamados set triado_em = (r->>'triado')::timestamptz where id = v;
      if r->>'statusFinal' is not null then
        update chamados set responsavel = r->>'responsavel', status = (r->>'statusFinal')::status_chamado where id = v;
      end if;
    end if;

    update chamados set ultima_movimentacao_em = (r->>'movimentacao')::timestamptz where id = v;
  end loop;
end $$;

select status, count(*) from chamados where campos ? 'numero_original' group by status order by status;
`;

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
console.log(r.ok ? `Importados ${registros.length} chamados:` : `ERRO ${r.status}`, await r.text());
if (!r.ok) process.exit(1);
