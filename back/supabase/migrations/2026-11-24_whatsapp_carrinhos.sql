-- Resumo diário dos carrinhos abertos no grupo da loja no WhatsApp, às 8h de Brasília.
-- Usa o envio da Green-API de 2026-10-22_whatsapp_pedidos.sql (monitor.send_group).
--
--   🛒 *Carrinhos abertos* · 7 clientes · 870 cópias
--   • *Jéssica Caroline Pabst* · 410 cópias · ontem
--     (47) 99708-7417
--   • *Isadora Ribeiro* · 30 cópias · há 4 dias · apaga dia 20/12
--     isadora@gmail.com
--
-- Sem carrinho aberto, nada é enviado. Contas de admin ficam de fora (testes da loja).

-- "(47) 99708-7417"
create or replace function monitor.fmt_phone(raw text) returns text
language sql immutable as $$
  select case length(d)
    when 11 then format('(%s) %s-%s', substr(d, 1, 2), substr(d, 3, 5), substr(d, 8))
    when 10 then format('(%s) %s-%s', substr(d, 1, 2), substr(d, 3, 4), substr(d, 7))
    else nullif(raw, '')
  end
  from (select regexp_replace(coalesce(raw, ''), '\D', '', 'g') as d) x
$$;

create or replace function monitor.carts_text() returns text
language sql stable as $$
  with carts as (
    select p.user_id,
           sum(p.quantity) as copias,
           (max(p.created_at) at time zone 'America/Sao_Paulo')::date as ultimo
      from public.photos p
      join public.profiles pr on pr.id = p.user_id
     where p.order_id is null and not pr.is_admin
       and exists (select 1 from storage.objects o where o.name = p.storage_key)
     group by p.user_id
  ),
  ranked as (
    select c.*, row_number() over (order by c.copias desc, c.ultimo desc) as n,
           (now() at time zone 'America/Sao_Paulo')::date - c.ultimo as dias,
           c.ultimo + 30 as apaga  -- CART_RETENTION_DAYS em src/lib/cart-retention.ts
      from carts c
  )
  select concat_ws(E'\n',
    format('🛒 *Carrinhos abertos* · %s · %s cópias',
      case when count(*) = 1 then '1 cliente' else count(*) || ' clientes' end, sum(copias)),
    string_agg(
      concat_ws(E'\n',
        concat_ws(' · ',
          '• *' || coalesce(nullif(trim(pr.full_name), ''), u.email) || '*',
          r.copias || case when r.copias = 1 then ' cópia' else ' cópias' end,
          case r.dias when 0 then 'hoje' when 1 then 'ontem' else 'há ' || r.dias || ' dias' end,
          case when r.apaga - (now() at time zone 'America/Sao_Paulo')::date <= 5
               then 'apaga dia ' || to_char(r.apaga, 'DD/MM') end),
        '  ' || coalesce(monitor.fmt_phone(pr.whatsapp), u.email)),
      E'\n' order by r.n) filter (where r.n <= 8),
    case when count(*) > 8 then format('+%s com menos fotos', count(*) - 8) end)
  from ranked r
  join auth.users u on u.id = r.user_id
  left join public.profiles pr on pr.id = r.user_id
  having count(*) > 0
$$;

create or replace function monitor.send_carts() returns void
language plpgsql as $$
declare
  body text := monitor.carts_text();
begin
  if body is not null and (select orders_chat_id from monitor.settings) is not null then
    perform monitor.send_group('carrinhos', body);
  end if;
exception when others then
  insert into public.error_logs (source, scope, message, detail, env)
  values ('server', 'monitor', sqlerrm, jsonb_build_object('etapa', 'carrinhos', 'sqlstate', sqlstate), 'production');
end $$;

revoke all on all functions in schema monitor from public, anon, authenticated;

-- pg_cron roda em UTC: 11h UTC = 8h em Brasília (sem horário de verão).
select cron.schedule('whatsapp-carrinhos', '0 11 * * *', 'select monitor.send_carts()');
