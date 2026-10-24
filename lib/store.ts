import fs from "fs";
import path from "path";
import type { Canal, Conversa, Db, Perfil, Ticket } from "./types";

// Persistência simples para o hackathon: memória + arquivo JSON local.
// Em ambiente sem disco gravável (ex.: Vercel) o arquivo falha em silêncio e fica só a memória.
const ARQUIVO = path.join(process.cwd(), "data", "db.json");

const g = globalThis as unknown as { __aprovaDb?: Db };

function carregar(): Db {
  if (g.__aprovaDb) return g.__aprovaDb;
  let db: Db = { conversas: {}, tickets: {}, sequencia: 0 };
  try {
    db = JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) as Db;
  } catch {
    // primeiro uso ou arquivo ausente
  }
  g.__aprovaDb = db;
  return db;
}

export function salvar() {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(carregar(), null, 2));
  } catch {
    // sem disco gravável: mantém em memória
  }
}

export function agora() {
  return new Date().toISOString();
}

export function buscarConversa(id: string): Conversa | undefined {
  return carregar().conversas[id];
}

/** Conversa ativa do contato no canal, ou uma nova. */
export function conversaDoContato(canal: Canal, contato: string, perfil: Perfil): Conversa {
  const db = carregar();
  const ativa = Object.values(db.conversas).find(
    (c) => c.canal === canal && c.contato === contato && c.status === "em_atendimento",
  );
  if (ativa) return ativa;
  return novaConversa(canal, contato, perfil);
}

export function novaConversa(canal: Canal, contato: string, perfil: Perfil): Conversa {
  const db = carregar();
  const conversa: Conversa = {
    id: `C-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    canal,
    contato,
    perfil,
    criadaEm: agora(),
    atualizadaEm: agora(),
    status: "em_atendimento",
    mensagens: [],
    transcript: [],
    turnosUsuario: 0,
    campos: {},
    artigosSugeridos: [],
  };
  db.conversas[conversa.id] = conversa;
  return conversa;
}

export function proximoProtocolo(): string {
  const db = carregar();
  db.sequencia += 1;
  return `APV-${new Date().getFullYear()}-${String(db.sequencia).padStart(5, "0")}`;
}

export function gravarTicket(ticket: Ticket) {
  carregar().tickets[ticket.id] = ticket;
  salvar();
}

export function listarTickets(): Ticket[] {
  return Object.values(carregar().tickets).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function listarConversas(): Conversa[] {
  return Object.values(carregar().conversas);
}

export function buscarTicket(id: string): Ticket | undefined {
  return carregar().tickets[id];
}

export function limparTudo() {
  g.__aprovaDb = { conversas: {}, tickets: {}, sequencia: 0 };
  salvar();
}
