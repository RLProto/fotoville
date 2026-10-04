-- Bot de WhatsApp da loja: status do bucket, avisos de uso e erros do site publicado.
-- Roda inteiro no Supabase: o pg_cron agenda, o pg_net chama o CallMeBot e a chave fica no Vault.
-- Telefone e chave não entram no git: depois de aplicar, rode `npm run whatsapp -- config` (lê o .env.local).
--
--   8h de Brasília       status do bucket
--   de hora em hora      um aviso ao passar de 70%; acima de 90%, alerta a cada hora
--   a cada 10 minutos    erros novos do site publicado (error_logs, nível erro)

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Esquema fora da API do Supabase: nenhum cliente do site chega aqui.
create schema if not exists monitor;
revoke all on schema monitor from public, anon, authenticated;

create table if not exists monitor.settings (
  id boolean primary key default true check (id),     -- uma linha só
  phone text,                                         -- com DDI, como o CallMeBot mostrou na ativação
  site_url text not null default 'https://fotoville-nu.vercel.app',
  quota_bytes bigint not null default 100000000000,   -- 100 GB contratados (Supabase Pro)
  warn_pct numeric not null default 70,
  alert_pct numeric not null default 90,
  daily_hour int not null default 8,                  -- hora de Brasília do status diário
  warned_at timestamptz,                              -- aviso de 70% já enviado; volta a null abaixo de 70%
  last_daily_on date,
  last_daily_bytes bigint,                            -- uso no último status, para o "desde ontem"
  last_alert_at timestamptz,
  last_error_id bigint not null default 0             -- último erro já avisado
);

-- Começa do erro mais recente: o que já estava no painel não é reenviado.
insert into monitor.settings (last_error_id)
select coalesce(max(id), 0) from public.error_logs
on conflict (id) do nothing;

-- Cada mensagem e a resposta do CallMeBot, conferida na rodada seguinte de erros.
create table if not exists monitor.messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,                                 -- status, aviso, alerta, erros, teste
  body text not null,
  request_id bigint,                                  -- pedido do pg_net; null sem telefone ou chave
  http_status int,
  error text,
  checked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Formatação: "350 MB", "70,3 GB", "0,4%", "1.234"
-- ---------------------------------------------------------------------------
create or replace function monitor.fmt_size(bytes bigint) returns text
language sql immutable as $$
  select case
    when bytes < 1000000000 then round(bytes / 1e6)::text || ' MB'
    else regexp_replace(replace(to_char(bytes / 1e9, 'FM999990.0'), '.', ','), ',0$', '') || ' GB'
  end
$$;

create or replace function monitor.fmt_pct(pct numeric) returns text
language sql immutable as $$
  select regexp_replace(replace(to_char(pct, 'FM990.0'), '.', ','), ',0$', '') || '%'
$$;

create or replace function monitor.fmt_count(n bigint) returns text
language sql immutable as $$
  select replace(to_char(n, 'FM999,999,990'), ',', '.')
$$;

-- ---------------------------------------------------------------------------
-- Uso do armazenamento: todos os buckets do projeto, que é o que conta na cota.
-- ---------------------------------------------------------------------------
create or replace function monitor.bucket_usage(out bytes bigint, out files bigint)
language sql stable as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0), count(*) from storage.objects
$$;

-- "350 MB de 100 GB (0,4%)"
create or replace function monitor.usage_line(used bigint) returns text
language sql stable as $$
  select format('%s de %s (%s)', monitor.fmt_size(used), monitor.fmt_size(quota_bytes),
                monitor.fmt_pct(100.0 * used / quota_bytes))
    from monitor.settings
$$;

-- Texto do status diário, com o uso de agora.
create or replace function monitor.status_text() returns text
language plpgsql stable as $$
declare
  s monitor.settings;
  u record;
  pct numeric;
  diff bigint;
begin
  select * into s from monitor.settings;
  select * into u from monitor.bucket_usage();
  pct := 100.0 * u.bytes / s.quota_bytes;
  diff := u.bytes - s.last_daily_bytes;
  return concat_ws(E'\n',
    case when pct >= s.alert_pct then '🔴 ' when pct >= s.warn_pct then '⚠️ ' else '' end || '*Bucket Fotoville*',
    monitor.usage_line(u.bytes),
    concat_ws(' · ',
      monitor.fmt_count(u.files) || ' arquivos',
      case
        when diff is null then null
        when abs(diff) < 500000 then 'igual a ontem'
        else format('%s%s desde ontem', case when diff > 0 then '+' else '-' end, monitor.fmt_size(abs(diff)))
      end));
end $$;

-- ---------------------------------------------------------------------------
-- Envio pelo CallMeBot. Sem telefone ou chave, só registra a mensagem.
-- ---------------------------------------------------------------------------
create or replace function monitor.send(msg_kind text, msg_body text) returns bigint
language plpgsql as $$
declare
  to_phone text := (select phone from monitor.settings);
  apikey text := (select decrypted_secret from vault.decrypted_secrets where name = 'callmebot_apikey');
  req bigint;
begin
  if to_phone is not null and apikey is not null then
    req := net.http_get(
      'https://api.callmebot.com/whatsapp.php',
      jsonb_build_object('phone', to_phone, 'text', msg_body, 'apikey', apikey),
      timeout_milliseconds => 30000
    );
  end if;
  insert into monitor.messages (kind, body, request_id, error, checked_at)
  values (msg_kind, msg_body, req,
          case when req is null then 'telefone ou chave não configurados' end,
          case when req is null then now() end);
  return req;
end $$;

-- Confere as respostas do CallMeBot. Falha de entrega vai para o painel de erros como aviso
-- (aviso não volta para o WhatsApp, senão uma chave inválida geraria mensagens sem fim).
create or replace function monitor.check_deliveries() returns void
language plpgsql as $$
begin
  with checked as (
    update monitor.messages m
       set http_status = r.status_code,
           error = case
             when r.timed_out then 'tempo esgotado'
             when r.error_msg is not null then r.error_msg
             when r.status_code <> 200 then
               left(trim(regexp_replace(regexp_replace(r.content, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 300)
           end,
           checked_at = now()
      from net._http_response r
     where r.id = m.request_id and m.checked_at is null
    returning m.id, m.kind, m.http_status, m.error
  )
  insert into public.error_logs (level, source, scope, message, detail, env)
  select 'warning', 'server', 'whatsapp', 'WhatsApp não entregue: ' || error,
         jsonb_build_object('mensagem', id, 'tipo', kind, 'http', http_status), 'production'
    from checked
   where error is not null;
end $$;

-- ---------------------------------------------------------------------------
-- De hora em hora: status diário, aviso de 70% e alerta de 90%.
-- ---------------------------------------------------------------------------
create or replace function monitor.check_bucket() returns void
language plpgsql as $$
declare
  s monitor.settings;
  u record;
  pct numeric;
  now_sp timestamp := now() at time zone 'America/Sao_Paulo';
begin
  select * into s from monitor.settings for update;
  select * into u from monitor.bucket_usage();
  pct := 100.0 * u.bytes / s.quota_bytes;

  -- Status diário. Se a rodada das 8h falhar, sai na seguinte. Ele já mostra o nível, então
  -- conta como o aviso de 70% e como o alerta de 90% desta hora.
  if extract(hour from now_sp) >= s.daily_hour and s.last_daily_on is distinct from now_sp::date then
    perform monitor.send('status', monitor.status_text());
    update monitor.settings
       set last_daily_on = now_sp::date,
           last_daily_bytes = u.bytes,
           warned_at = case when pct >= s.warn_pct then coalesce(warned_at, now()) end,
           last_alert_at = case when pct >= s.alert_pct then now() else last_alert_at end
     where id;
  elsif pct >= s.alert_pct then
    if s.last_alert_at is null or s.last_alert_at < now() - interval '50 minutes' then
      perform monitor.send('alerta', format(E'🔴 *Bucket Fotoville acima de %s*\n%s · livre: %s',
        monitor.fmt_pct(s.alert_pct), monitor.usage_line(u.bytes),
        monitor.fmt_size(greatest(s.quota_bytes - u.bytes, 0))));
      update monitor.settings set last_alert_at = now(), warned_at = coalesce(warned_at, now()) where id;
    end if;
  elsif pct >= s.warn_pct then
    if s.warned_at is null then
      perform monitor.send('aviso', format(E'⚠️ *Bucket Fotoville passou de %s*\n%s',
        monitor.fmt_pct(s.warn_pct), monitor.usage_line(u.bytes)));
      update monitor.settings set warned_at = now() where id;
    end if;
  elsif s.warned_at is not null then
    update monitor.settings set warned_at = null where id;
  end if;
exception when others then
  insert into public.error_logs (source, scope, message, detail, env)
  values ('server', 'monitor', sqlerrm, jsonb_build_object('etapa', 'bucket', 'sqlstate', sqlstate), 'production');
end $$;

-- ---------------------------------------------------------------------------
-- A cada 10 minutos: erros novos do site publicado numa mensagem só, agrupados por área.
-- ---------------------------------------------------------------------------
create or replace function monitor.check_errors() returns void
language plpgsql as $$
declare
  s monitor.settings;
  last_id bigint;
  total int;
  lines text;
begin
  perform monitor.check_deliveries();

  select * into s from monitor.settings for update;
  select max(id), count(*) into last_id, total
    from public.error_logs
   where id > s.last_error_id and env = 'production' and level = 'error';
  if total = 0 then
    return;
  end if;

  select string_agg(format('• %s (%s): %s', scope, n, message), E'\n' order by n desc, scope)
    into lines
    from (
      select scope, count(*) as n,
             regexp_replace(left((array_agg(message order by id desc))[1], 120), '\s+', ' ', 'g') as message
        from public.error_logs
       where id > s.last_error_id and id <= last_id and env = 'production' and level = 'error'
       group by scope
       order by n desc, scope
       limit 5
    ) g;

  perform monitor.send('erros', format(E'❗ *%s no site Fotoville*\n%s\n%s/admin/erros',
    case when total = 1 then '1 erro' else total || ' erros' end, lines, s.site_url));
  update monitor.settings set last_error_id = last_id where id;
exception when others then
  insert into public.error_logs (source, scope, message, detail, env)
  values ('server', 'monitor', sqlerrm, jsonb_build_object('etapa', 'erros', 'sqlstate', sqlstate), 'production');
end $$;

revoke all on all tables in schema monitor from public, anon, authenticated;
revoke all on all functions in schema monitor from public, anon, authenticated;

-- O pg_cron do Supabase roda em UTC: "0 * * * *" é toda hora cheia; a hora de Brasília é tratada acima.
select cron.schedule('whatsapp-bucket', '0 * * * *', 'select monitor.check_bucket()');
select cron.schedule('whatsapp-erros', '*/10 * * * *', 'select monitor.check_errors()');
