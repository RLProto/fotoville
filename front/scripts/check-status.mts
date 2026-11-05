/**
 * Confere as regras da mudança de status em massa no banco, contra as da tela (canBulkChange):
 * cria um pedido de cada combinação numa transação e desfaz tudo no fim. Como nada é confirmado, nenhum
 * pedido aparece no site nem gera aviso no grupo do WhatsApp; o número informado à mão não gasta a sequência.
 * Uso: npm run check:status
 */
import pg from "pg";
import { BULK_STATUSES, canBulkChange } from "../src/lib/order-rules.ts";
import type { OrderStatus } from "../src/lib/types.ts";

process.loadEnvFile(".env.local");

const STATUSES: OrderStatus[] = ["pending", "paid", "in_production", "shipped", "ready_for_pickup", "delivered", "cancelled"];
const KINDS = ["prints", "package"] as const;
const SERVICES = ["pac", "sedex", "motoboy", "retirada", null] as const;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

let failures = 0;
let checked = 0;
const fail = (text: string) => {
  failures++;
  console.log(`FALHOU ${text}`);
};

try {
  await client.query("begin");
  const { rows: users } = await client.query("select id from auth.users limit 1");

  let number = 0;
  for (const to of BULK_STATUSES) {
    for (const kind of KINDS) {
      for (const shipping_service of SERVICES) {
        for (const status of STATUSES) {
          number -= 1;
          const { rows } = await client.query(
            `insert into public.orders (number, user_id, kind, status, shipping_service)
             overriding system value values ($1, $2, $3, $4, $5) returning id`,
            [number, users[0].id, kind, status, shipping_service],
          );
          const id = rows[0].id;
          const { rows: changed } = await client.query("select id from public.bulk_order_status($1::uuid[], $2)", [[id], to]);
          const { rows: after } = await client.query("select status from public.orders where id = $1", [id]);
          const expected = canBulkChange({ kind, status, shipping_service }, to);
          const combo = `${kind}/${shipping_service}: ${status} → ${to}`;
          checked++;
          if (Boolean(changed.length) !== expected) fail(`${combo}: banco ${changed.length ? "mudou" : "recusou"}, tela diz ${expected}`);
          if (after[0].status !== (expected ? to : status)) fail(`${combo}: ficou ${after[0].status}`);
        }
      }
    }
  }

  // Voltar para aguardando pagamento e status desconhecido nunca passam
  const { rows: pendingRows } = await client.query(
    `insert into public.orders (number, user_id) overriding system value values ($1, $2) returning id`,
    [number - 1, users[0].id],
  );
  const pendingId = pendingRows[0].id;
  for (const to of ["pending", "qualquer"]) {
    const { rows } = await client.query("select id from public.bulk_order_status($1::uuid[], $2)", [[pendingId], to]);
    checked++;
    if (rows.length) fail(`${to} não deveria passar`);
  }

  // Pagamento aprovado grava o mesmo que markOrderPaid, e o histórico usa a data do pagamento
  await client.query("select id from public.bulk_order_status($1::uuid[], 'paid')", [[pendingId]]);
  const { rows: paidRows } = await client.query(
    `select o.status, o.paid_at, o.payment_method, o.mp_payment_id,
            (select e.created_at from public.order_events e where e.order_id = o.id and e.status = 'paid') as event_at
       from public.orders o where o.id = $1`,
    [pendingId],
  );
  const paid = paidRows[0];
  checked++;
  if (paid.status !== "paid" || !paid.paid_at || paid.payment_method !== "manual" || paid.mp_payment_id !== null) {
    fail(`pagamento aprovado gravou ${JSON.stringify(paid)}`);
  }
  if (paid.event_at?.getTime() !== paid.paid_at?.getTime()) fail("histórico do pagamento com outra data");

  // Outros status não mexem nos dados do pagamento
  await client.query("select id from public.bulk_order_status($1::uuid[], 'in_production')", [[pendingId]]);
  const { rows: keptRows } = await client.query("select paid_at, payment_method from public.orders where id = $1", [pendingId]);
  checked++;
  if (keptRows[0].paid_at?.getTime() !== paid.paid_at?.getTime() || keptRows[0].payment_method !== "manual") {
    fail("mudar para em produção alterou os dados do pagamento");
  }

  // O histórico registra cada mudança, com um lote de verdade
  const { rows: batch } = await client.query(
    `insert into public.orders (number, user_id, status)
     overriding system value select -100000 - n, $1::uuid, 'paid' from generate_series(1, 500) n returning id`,
    [users[0].id],
  );
  const ids = batch.map((row) => row.id);
  const { rows: moved } = await client.query("select id from public.bulk_order_status($1::uuid[], 'in_production')", [ids]);
  const { rows: events } = await client.query(
    "select count(*)::int as total from public.order_events where order_id = any($1::uuid[]) and status = 'in_production'",
    [ids],
  );
  checked += 2;
  if (moved.length !== 500) fail(`lote de 500: mudaram ${moved.length}`);
  if (events[0].total !== 500) fail(`histórico do lote: ${events[0].total} registros`);

  // Etiquetas: só as disponíveis são marcadas
  const { rows: labels } = await client.query(
    `insert into public.orders (number, user_id, status, label_ready_at)
     overriding system value values (-200001, $1::uuid, 'in_production', now()), (-200002, $1::uuid, 'in_production', null) returning id`,
    [users[0].id],
  );
  await client.query("select public.mark_labels_printed($1::uuid[])", [labels.map((row) => row.id)]);
  const { rows: printed } = await client.query(
    "select label_ready_at is not null as ready, label_printed_at is not null as printed from public.orders where id = any($1::uuid[])",
    [labels.map((row) => row.id)],
  );
  checked++;
  if (!printed.every((row) => row.ready === row.printed)) fail("etiquetas: marcou o que não estava disponível");
} catch (err) {
  failures++;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  await client.query("rollback");
  await client.end();
}

console.log(failures ? `\n${failures} de ${checked} verificações falharam.` : `\nTudo certo: ${checked} verificações.`);
process.exit(failures ? 1 : 0);
