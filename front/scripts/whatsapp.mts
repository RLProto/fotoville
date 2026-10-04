/**
 * Bot do WhatsApp: status do bucket e avisos de erro. Roda no Supabase
 * (back/supabase/migrations/2026-10-04_whatsapp_monitor.sql); este script só configura e testa.
 * Uso:
 *   npm run whatsapp -- config   grava WHATSAPP_PHONE e CALLMEBOT_APIKEY do .env.local no banco
 *   npm run whatsapp -- teste    envia o status do bucket agora e mostra a resposta do CallMeBot
 */
import pg from "pg";

process.loadEnvFile(".env.local");

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Falta ${name} no .env.local.`);
    process.exit(1);
  }
  return value;
};

const command = process.argv[2];
if (command !== "config" && command !== "teste") {
  console.error("Uso: npm run whatsapp -- config | teste");
  process.exit(1);
}

const client = new pg.Client({ connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await client.connect();
let failed = false;

try {
  if (command === "config") {
    const phone = "+" + env("WHATSAPP_PHONE").replace(/\D/g, "");
    const apikey = env("CALLMEBOT_APIKEY");
    await client.query("update monitor.settings set phone = $1 where id", [phone]);
    const { rows } = await client.query("select id from vault.secrets where name = 'callmebot_apikey'");
    if (rows.length) await client.query("select vault.update_secret($1, $2)", [rows[0].id, apikey]);
    else await client.query("select vault.create_secret($1, 'callmebot_apikey', 'CallMeBot: bot do WhatsApp')", [apikey]);
    console.log(`OK   mensagens vão para ${phone}`);
  } else {
    const { rows: [config] } = await client.query(
      "select phone is not null and exists (select 1 from vault.secrets where name = 'callmebot_apikey') as ok from monitor.settings",
    );
    if (!config?.ok) throw new Error("telefone ou chave não configurados: rode npm run whatsapp -- config");
    const { rows } = await client.query("select monitor.status_text() as body");
    const { body } = rows[0];
    console.log(body, "\n");
    const { rows: [{ req }] } = await client.query("select monitor.send('teste', $1) as req", [body]);

    // O pg_net envia em segundo plano; a resposta aparece em alguns segundos.
    let response = null;
    for (let i = 0; i < 40 && !response; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ({ rows: [response] } = await client.query(
        "select status_code, error_msg, timed_out, content from net._http_response where id = $1",
        [req],
      ));
    }
    if (!response) throw new Error("sem resposta do CallMeBot em 40 s");
    const text = String(response.content ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    failed = response.status_code !== 200;
    console.log(`${failed ? "FALHOU" : "OK  "} HTTP ${response.status_code ?? "-"} ${response.error_msg ?? ""} ${text.slice(0, 300)}`);
    await client.query("select monitor.check_deliveries()");
  }
} catch (err) {
  failed = true;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  await client.end();
}

process.exit(failed ? 1 : 0);
