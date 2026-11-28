-- Resumo das 8h (carrinhos em aberto + status do bucket) vai para o grupo da administração, de segunda a
-- sexta, e deixa de sair no grupo dos pedidos (pedido do usuário em 27/11/2026). O grupo dos pedidos segue
-- com o aviso de cada pedido novo.
-- O id do grupo fica fora do git: update monitor.settings set admin_chat_id = '<id>@g.us' where id;

alter table monitor.settings add column if not exists admin_chat_id text;

-- Envio pela Green-API para qualquer grupo; send_group(kind, body) continua indo para o grupo dos pedidos.
create or replace function monitor.send_group(msg_kind text, msg_body text, msg_chat text)
returns bigint
language plpgsql as $$
declare
  api jsonb := (select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'greenapi');
  req bigint;
begin
  if msg_chat is not null and api is not null then
    req := net.http_post(
      format('%s/waInstance%s/sendMessage/%s', api ->> 'url', api ->> 'id', api ->> 'token'),
      jsonb_build_object('chatId', msg_chat, 'message', msg_body),
      headers => '{"Content-Type": "application/json"}',
      timeout_milliseconds => 30000
    );
  end if;
  insert into monitor.messages (kind, body, request_id, error, checked_at)
  values (msg_kind, msg_body, req,
          case when req is null then 'grupo ou chave da Green-API não configurados' end,
          case when req is null then now() end);
  return req;
end $$;

create or replace function monitor.send_group(msg_kind text, msg_body text)
returns bigint
language sql as $$
  select monitor.send_group(msg_kind, msg_body, (select orders_chat_id from monitor.settings))
$$;

/** Mensagem das 8h no grupo da administração. Sem carrinho, sai só o status do bucket. */
create or replace function monitor.admin_text() returns text
language sql stable as $$
  select concat_ws(E'\n\n',
    coalesce(monitor.carts_text(), E'🛒 *Carrinhos em aberto*\nNenhum hoje'),
    monitor.status_text())
$$;

create or replace function monitor.send_carts() returns void
language plpgsql as $$
declare
  chat text := (select admin_chat_id from monitor.settings);
begin
  if chat is not null then
    perform monitor.send_group('carrinhos', monitor.admin_text(), chat);
  end if;
exception when others then
  insert into public.error_logs (source, scope, message, detail, env)
  values ('server', 'monitor', sqlerrm, jsonb_build_object('etapa', 'carrinhos', 'sqlstate', sqlstate), 'production');
end $$;

revoke all on all functions in schema monitor from public, anon, authenticated;

-- pg_cron roda em UTC: 11h UTC = 8h em Brasília (sem horário de verão), de segunda (1) a sexta (5).
select cron.schedule('whatsapp-carrinhos', '0 11 * * 1-5', 'select monitor.send_carts()');
