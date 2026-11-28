-- Mensagens do armazenamento sem a palavra "bucket" (pedido do usuário em 27/11/2026). Lógica igual à de
-- 2026-10-04_whatsapp_monitor.sql; só os textos mudam.

create or replace function monitor.usage_line(used bigint) returns text
language sql stable as $$
  select format('%s de %s usados (%s)', monitor.fmt_size(used), monitor.fmt_size(quota_bytes),
                monitor.fmt_pct(100.0 * used / quota_bytes))
    from monitor.settings
$$;

create or replace function monitor.status_text() returns text
language plpgsql stable as $$
declare
  s monitor.settings;
  u record;
  pct numeric;
  diff bigint;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  since text;
begin
  select * into s from monitor.settings;
  select * into u from monitor.bucket_usage();
  pct := 100.0 * u.bytes / s.quota_bytes;
  -- Compara com o último status de um dia anterior; um teste no mesmo dia não mostra variação.
  if s.last_daily_on < today then
    diff := u.bytes - s.last_daily_bytes;
    since := case when s.last_daily_on = today - 1 then 'ontem' else to_char(s.last_daily_on, 'DD/MM') end;
  end if;
  return concat_ws(E'\n',
    case when pct >= s.alert_pct then '🔴 ' when pct >= s.warn_pct then '⚠️ ' else '' end || '*Armazenamento das fotos*',
    monitor.usage_line(u.bytes),
    concat_ws(' · ',
      monitor.fmt_count(u.files) || ' arquivos',
      case
        when diff is null then null
        when abs(diff) < 500000 then 'igual a ' || since
        else format('%s%s desde %s', case when diff > 0 then '+' else '-' end, monitor.fmt_size(abs(diff)), since)
      end));
end $$;

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
      perform monitor.send('alerta', format(E'🔴 *Armazenamento das fotos acima de %s*\n%s · livres: %s',
        monitor.fmt_pct(s.alert_pct), monitor.usage_line(u.bytes),
        monitor.fmt_size(greatest(s.quota_bytes - u.bytes, 0))));
      update monitor.settings set last_alert_at = now(), warned_at = coalesce(warned_at, now()) where id;
    end if;
  elsif pct >= s.warn_pct then
    if s.warned_at is null then
      perform monitor.send('aviso', format(E'⚠️ *Armazenamento das fotos passou de %s*\n%s',
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

revoke all on all functions in schema monitor from public, anon, authenticated;
