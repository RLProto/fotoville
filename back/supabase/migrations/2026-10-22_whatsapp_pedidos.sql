-- Aviso de pedido novo num grupo do WhatsApp, enviado pelo chip da loja (WhatsApp Business).
-- O chip fica conectado à Green-API como aparelho vinculado (QR code), que é quem posta no grupo.
-- A chave da Green-API fica no Vault; grupo e chave são gravados com `npm run whatsapp -- grupo`.
--
--   a cada minuto   pedidos novos (pagos ou não), um aviso por pedido
--
-- O aviso sai depois de 30 s: o checkout grava os itens depois do pedido e desfaz o pedido se algo falhar,
-- então pedido desfeito nunca é avisado.

alter table monitor.settings
  add column if not exists orders_chat_id text,          -- grupo da Green-API (...@g.us)
  add column if not exists last_order_number bigint;     -- último pedido já avisado

-- Começa do pedido mais recente: os antigos não são reenviados.
update monitor.settings
   set last_order_number = (select coalesce(max(number), 0) from public.orders)
 where id and last_order_number is null;

-- "R$ 1.929,07"
create or replace function monitor.fmt_money(cents bigint) returns text
language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(cents / 100.0, 'FM999,999,990.00'), ',', '_'), '.', ','), '_', '.')
$$;

-- Envio pela Green-API para o grupo dos pedidos. Sem grupo ou chave, só registra a mensagem.
-- A resposta é conferida por monitor.check_deliveries, como as do CallMeBot.
create or replace function monitor.send_group(msg_kind text, msg_body text) returns bigint
language plpgsql as $$
declare
  chat text := (select orders_chat_id from monitor.settings);
  api jsonb := (select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'greenapi');
  req bigint;
begin
  if chat is not null and api is not null then
    req := net.http_post(
      format('%s/waInstance%s/sendMessage/%s', api ->> 'url', api ->> 'id', api ->> 'token'),
      jsonb_build_object('chatId', chat, 'message', msg_body),
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

-- Texto do aviso de um pedido:
--   🛒 *Pedido #1067* · aguardando pagamento
--   Maria Silva · R$ 45,80
--   12× 10x15 cm · 4× Polaroid
--   Motoboy (Costa e Silva, Joinville)
--   https://.../admin/pedidos/<id>
create or replace function monitor.order_text(order_id uuid) returns text
language sql stable as $$
  select concat_ws(E'\n',
    format('🛒 *Pedido #%s* · %s', o.number, case o.status
      when 'pending' then 'aguardando pagamento'
      when 'paid' then 'pago'
      when 'cancelled' then 'cancelado'
      else 'pago' end),
    concat_ws(' · ', nullif(trim(o.customer ->> 'name'), ''), monitor.fmt_money(o.total_cents)),
    -- Os 4 itens com mais cópias; o resto vira "+N" (a contagem da janela sai antes do limit)
    (select string_agg(case when o.kind = 'package' then description else quantity || '× ' || description end,
                       ' · ' order by quantity desc, description)
            || case when max(total) > 4 then format(' +%s', max(total) - 4) else '' end
       from (select description, quantity, count(*) over () as total from public.order_items
              where order_id = o.id order by quantity desc, description limit 4) i),
    o.shipping_label,
    (select site_url from monitor.settings) || '/admin/pedidos/' || o.id)
  from public.orders o
  where o.id = order_id
$$;

-- A cada minuto: avisa cada pedido novo com mais de 30 s, em ordem.
create or replace function monitor.check_orders() returns void
language plpgsql as $$
declare
  s monitor.settings;
  o record;
begin
  select * into s from monitor.settings for update;
  if s.orders_chat_id is null then
    return;
  end if;
  for o in
    select id, number from public.orders
     where number > s.last_order_number and created_at < now() - interval '30 seconds'
     order by number
     limit 20
  loop
    perform monitor.send_group('pedido', monitor.order_text(o.id));
    update monitor.settings set last_order_number = o.number where id;
  end loop;
exception when others then
  insert into public.error_logs (source, scope, message, detail, env)
  values ('server', 'monitor', sqlerrm, jsonb_build_object('etapa', 'pedidos', 'sqlstate', sqlstate), 'production');
end $$;

revoke all on all functions in schema monitor from public, anon, authenticated;

select cron.schedule('whatsapp-pedidos', '* * * * *', 'select monitor.check_orders()');
