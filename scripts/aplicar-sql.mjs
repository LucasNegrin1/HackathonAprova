// Aplica arquivos SQL no projeto Supabase pela Management API.
// Uso: node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/arquivo.sql [outro.sql...]
import fs from "fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
if (!token) throw new Error("Defina SUPABASE_ACCESS_TOKEN no .env.local");

for (const arquivo of process.argv.slice(2)) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: fs.readFileSync(arquivo, "utf8") }),
  });
  const corpo = await r.text();
  console.log(`${r.ok ? "OK   " : "ERRO "} ${arquivo} (${r.status})${r.ok ? "" : "\n" + corpo}`);
  if (!r.ok) process.exit(1);
}
