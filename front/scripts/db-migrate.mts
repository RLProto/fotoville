/**
 * Aplica arquivos SQL de back/supabase/migrations no banco, numa transação por arquivo.
 * Precisa de DATABASE_URL no .env.local (Supabase > Connect > Session pooler).
 * Uso: npm run db:migrate -- 2026-10-04_price_profiles.sql [outro.sql ...]
 */
import { readFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL no .env.local.");
  process.exit(1);
}
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Informe o nome do arquivo em back/supabase/migrations.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of files) {
    const sql = readFileSync(new URL(`../../back/supabase/migrations/${file}`, import.meta.url), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
      console.log(`aplicado: ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
} finally {
  await client.end();
}
