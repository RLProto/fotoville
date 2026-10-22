/**
 * Bot do WhatsApp: status do bucket e avisos de erro (CallMeBot, para o celular) e pedidos novos
 * (Green-API, num grupo, enviados pelo chip da loja). Roda no Supabase
 * (back/supabase/migrations/2026-10-04_whatsapp_monitor.sql e 2026-10-22_whatsapp_pedidos.sql);
 * este script só configura e testa.
 * Uso:
 *   npm run whatsapp -- config         grava WHATSAPP_PHONE e CALLMEBOT_APIKEY do .env.local no banco
 *   npm run whatsapp -- teste          envia o status do bucket agora e mostra a resposta do CallMeBot
 *   npm run whatsapp -- grupo          grava a chave da Green-API e cria o grupo dos pedidos com PEDIDOS_WHATSAPP
 *   npm run whatsapp -- teste-pedido   envia o último pedido para o grupo
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
if (!["config", "teste", "grupo", "teste-pedido"].includes(command)) {
  console.error("Uso: npm run whatsapp -- config | teste | grupo | teste-pedido");
  process.exit(1);
}

const GROUP_NAME = "Pedidos Fotoville";

const client = new pg.Client({ connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await client.connect();
let failed = false;

async function saveSecret(name: string, value: string, description: string) {
  const { rows } = await client.query("select id from vault.secrets where name = $1", [name]);
  if (rows.length) await client.query("select vault.update_secret($1, $2)", [rows[0].id, value]);
  else await client.query("select vault.create_secret($1, $2, $3)", [value, name, description]);
}

/** Chama a Green-API: {url}/waInstance{id}/{método}/{token}. */
async function greenApi(method: string, body?: unknown) {
  const base = env("GREENAPI_URL").replace(/\/+$/, "");
  const res = await fetch(`${base}/waInstance${env("GREENAPI_INSTANCE")}/${method}/${env("GREENAPI_TOKEN")}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Green-API ${method}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** O pg_net envia em segundo plano; espera a resposta, mostra e devolve se falhou. */
async function showResponse(req: number, service: string) {
  let response = null;
  for (let i = 0; i < 40 && !response; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ({ rows: [response] } = await client.query(
      "select status_code, error_msg, timed_out, content from net._http_response where id = $1",
      [req],
    ));
  }
  if (!response) throw new Error(`sem resposta do ${service} em 40 s`);
  const text = String(response.content ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const bad = response.status_code !== 200;
  console.log(`${bad ? "FALHOU" : "OK  "} HTTP ${response.status_code ?? "-"} ${response.error_msg ?? ""} ${text.slice(0, 300)}`);
  await client.query("select monitor.check_deliveries()");
  return bad;
}

try {
  if (command === "config") {
    const phone = "+" + env("WHATSAPP_PHONE").replace(/\D/g, "");
    await client.query("update monitor.settings set phone = $1 where id", [phone]);
    await saveSecret("callmebot_apikey", env("CALLMEBOT_APIKEY"), "CallMeBot: bot do WhatsApp");
    console.log(`OK   mensagens vão para ${phone}`);
  } else if (command === "teste") {
    const { rows: [config] } = await client.query(
      "select phone is not null and exists (select 1 from vault.secrets where name = 'callmebot_apikey') as ok from monitor.settings",
    );
    if (!config?.ok) throw new Error("telefone ou chave não configurados: rode npm run whatsapp -- config");
    const { rows } = await client.query("select monitor.status_text() as body");
    const { body } = rows[0];
    console.log(body, "\n");
    const { rows: [{ req }] } = await client.query("select monitor.send('teste', $1) as req", [body]);
    failed = await showResponse(req, "CallMeBot");
  } else if (command === "grupo") {
    const { stateInstance } = await greenApi("getStateInstance");
    if (stateInstance !== "authorized") {
      throw new Error(`o chip não está conectado (${stateInstance}): leia o QR code no painel da Green-API`);
    }
    await saveSecret(
      "greenapi",
      JSON.stringify({
        url: env("GREENAPI_URL").replace(/\/+$/, ""),
        id: env("GREENAPI_INSTANCE"),
        token: env("GREENAPI_TOKEN"),
      }),
      "Green-API: grupo dos pedidos no WhatsApp",
    );
    const { rows: [settings] } = await client.query("select orders_chat_id from monitor.settings");
    if (settings.orders_chat_id) {
      console.log(`OK   chave gravada; o grupo já existe (${settings.orders_chat_id})`);
    } else {
      // O número no formato que o WhatsApp usa: no Brasil, alguns ficam sem o nono dígito
      const check = await greenApi("checkWhatsapp", { chatId: env("PEDIDOS_WHATSAPP").replace(/\D/g, "") + "@c.us" });
      if (!check.existsWhatsapp) throw new Error("PEDIDOS_WHATSAPP não tem WhatsApp");
      const member = check.phoneNumber || check.chatId;
      const group = await greenApi("createGroup", { groupName: GROUP_NAME, chatIds: [member] });
      if (!group.created) throw new Error(`grupo não criado: ${JSON.stringify(group)}`);
      await client.query("update monitor.settings set orders_chat_id = $1 where id", [group.chatId]);
      console.log(`OK   grupo "${GROUP_NAME}" criado com ${member} (${group.chatId})`);
      if (group.groupInviteLink) console.log(`     convite para mais gente: ${group.groupInviteLink}`);
    }
  } else {
    const { rows: [last] } = await client.query(
      "select monitor.order_text(id) as body from public.orders order by number desc limit 1",
    );
    if (!last) throw new Error("nenhum pedido no banco");
    console.log(last.body, "\n");
    const { rows: [{ req }] } = await client.query("select monitor.send_group('teste', $1) as req", [last.body]);
    if (req === null) throw new Error("grupo ou chave não configurados: rode npm run whatsapp -- grupo");
    failed = await showResponse(req, "Green-API");
  }
} catch (err) {
  failed = true;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  await client.end();
}

process.exit(failed ? 1 : 0);
