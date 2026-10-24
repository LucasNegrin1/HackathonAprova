// Testa o fluxo de triagem do banco num Postgres em memória (PGlite). Uso: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
const ok = (c, msg) => { console.log((c ? "OK   " : "FALHA") + " " + msg); if (!c) process.exitCode = 1; };
const q = async (sql, p) => (await db.query(sql, p)).rows;
const erro = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

await db.exec("create role anon; create role authenticated; create role service_role;");
const pasta = new URL("../supabase/migrations/", import.meta.url);
for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(new URL(arquivo, pasta), "utf8"));
}

const [{ id: conta }] = await q("insert into contas (nome, cota_p1) values ('Campinas', 2) returning id");
const novo = async (titulo) => (await q("insert into chamados (conta_id, titulo, impacto_informado, prazo_informado) values ($1,$2,'equipe parada', current_date + 2) returning id, protocolo, status", [conta, titulo]))[0];
const pri = async (id) => (await q("select prioridade, impacto_efetivo, volume_grupo, status from chamados where id=$1", [id]))[0];

const A = await novo("A"); ok(A.status === "aberto" && /^APV-\d{4}-00001$/.test(A.protocolo), `abertura: ${A.protocolo} status aberto`);
await q("select triar_chamado($1,'problema',3,3)", [A.id]); ok((await pri(A.id)).prioridade === "P1", "3x3 vira P1");
const B = await novo("B"); await q("select triar_chamado($1,'problema',3,3)", [B.id]);
const C = await novo("C"); const e1 = await erro("select triar_chamado($1,'problema',3,3)", [C.id]);
ok(e1 === "COTA_P1_EXCEDIDA", "3º P1 com cota 2 é bloqueado: " + e1);
ok((await pri(C.id)).status === "aberto", "chamado bloqueado continua aguardando triagem");
await q("select rebaixar_p1($1,'cliente aceitou aguardar')", [A.id]); ok((await pri(A.id)).prioridade === "P2", "rebaixar_p1 deixa A em P2");
ok((await erro("select triar_chamado($1,'problema',3,3)", [C.id])) === null && (await pri(C.id)).prioridade === "P1", "depois do rebaixamento, C entra como P1");
const D = await novo("D"); await q("select triar_chamado($1,'problema',3,3, null, 'prazo legal de embargo amanhã')", [D.id]);
ok((await pri(D.id)).prioridade === "P1", "P1 acima da cota com justificativa é aceito");
ok((await q("select cota_esgotada, p1_abertos from uso_cota_p1"))[0].p1_abertos === 3, "uso_cota_p1 mostra 3 P1 abertos");

const E = await novo("E sugestão"); await q("select triar_chamado($1,'sugestao')", [E.id]);
ok((await pri(E.id)).status === "backlog_produto", "sugestão vai para backlog_produto");
ok((await q("select count(*)::int n from fila_atendimento where id=$1", [E.id]))[0].n === 0, "backlog sai da fila de atendimento");

const F = await novo("F erro geral"); await q("select triar_chamado($1,'problema',2,2)", [F.id]);
ok((await pri(F.id)).prioridade === "P3", "2x2 vira P3");
for (const t of ["F1", "F2"]) { const f = await novo(t); await q("select triar_chamado($1,'problema',null,null,$2)", [f.id, F.id]); }
let pf = await pri(F.id); ok(pf.volume_grupo === 2 && pf.prioridade === "P3", "2 vinculados: volume 2, ainda P3");
const F3 = await novo("F3"); await q("select vincular_chamado($1,$2)", [F3.id, F.id]);
pf = await pri(F.id); ok(pf.volume_grupo === 3 && pf.impacto_efetivo === 3 && pf.prioridade === "P2", `3 vinculados: impacto efetivo 3 → ${pf.prioridade}`);
ok((await pri(F3.id)).status === "vinculado", "filho fica com status vinculado");
ok((await q("select count(*)::int n from fila_atendimento where id=$1", [F3.id]))[0].n === 0, "vinculados não aparecem na fila (só o pai)");
const F4 = await novo("F4"); await q("select vincular_chamado($1,$2)", [F4.id, F3.id]);
ok((await q("select chamado_pai_id from chamados where id=$1", [F4.id]))[0].chamado_pai_id === F.id, "vincular a um filho liga na raiz do grupo");

const fila = await q("select posicao, protocolo, prioridade from fila_atendimento");
console.log("     fila:", fila.map((r) => `${r.posicao}.${r.prioridade}`).join(" "));
ok(fila.map((r) => r.prioridade).join() === "P1,P1,P1,P2,P2", "fila ordenada por prioridade");

await q("update chamados set ultima_movimentacao_em = now() - interval '11 days' where id=$1", [F.id]);
ok((await q("select count(*)::int n from chamados_parados"))[0].n === 1, "chamados_parados encontra o chamado de 11 dias");
ok((await q("select escalar_parados() n"))[0].n === 1, "escalar_parados escala 1");
ok((await q("select escalar_parados() n"))[0].n === 0, "não escala de novo sem nova movimentação");
const filaEsc = await q("select protocolo, escalado from fila_atendimento where prioridade='P2'");
ok(filaEsc[0].escalado === true, "na mesma prioridade, escalado vem primeiro");
await q("insert into eventos_chamado (chamado_id, tipo) values ($1,'interacao')", [F.id]);
ok((await q("select count(*)::int n from chamados_parados"))[0].n === 0, "interação registrada tira o chamado de parados");

ok((await q("select resolver_chamado($1,'corrigido no deploy 1.2.3') n", [F.id]))[0].n === 5, "resolver o pai fecha 1 + 4 vinculados");
ok((await q("select count(*)::int n from chamados where chamado_pai_id=$1 and status='resolvido'", [F.id]))[0].n === 4, "vinculados resolvidos em lote");
ok((await erro("select rebaixar_p1($1,'x')", [F.id])) !== null, "rebaixar um não-P1 dá erro");
ok((await erro("select rebaixar_p1($1,'x')", [D.id])) === null, "rebaixar um P1 na fila funciona");
await q("select resolver_chamado($1,'ok')", [C.id]);
ok((await erro("select rebaixar_p1($1,'x')", [C.id])) !== null, "rebaixar um P1 já resolvido dá erro");
ok((await erro("select triar_chamado($1,'problema')", [(await novo("G")).id])) !== null, "triagem de problema exige impacto e urgência");
console.log("     eventos:", (await q("select tipo, count(*)::int n from eventos_chamado group by tipo order by tipo")).map((r) => `${r.tipo}=${r.n}`).join(" "));
