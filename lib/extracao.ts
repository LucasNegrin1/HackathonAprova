// Extração determinística de identificadores que o modelo às vezes esquece de registrar.
// Só o que dá para reconhecer com segurança: número de processo, e-mail e CPF.

// Formatos de número de processo: "133-26-PMB-CGR" (Aprova) e "2026/001234".
const PROCESSO = /\b(\d{2,6}-\d{2}-[A-Z]{2,5}-[A-Z]{2,6}|20\d{2}\/\d{3,})\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

export function extrairIdentificadores(texto: string): { id: string; valor: string }[] {
  const achados: { id: string; valor: string }[] = [];
  const processo = texto.match(PROCESSO);
  if (processo) achados.push({ id: "numero_processo", valor: processo[1].toUpperCase() });
  const contato = texto.match(EMAIL) ?? texto.match(CPF);
  if (contato) achados.push({ id: "email_ou_cpf", valor: contato[0] });
  return achados;
}

/** "20/11", "20/11/2026" → "2026-11-20". Sem data reconhecível → "". */
export function dataIso(texto = ""): string {
  const m = texto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!m) return "";
  const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(new Date().getFullYear());
  return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
