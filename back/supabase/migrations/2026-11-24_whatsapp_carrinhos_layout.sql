-- Resumo diário dos carrinhos: agrupado por dia do último envio, do mais recente para o mais antigo.
--
--   🛒 *Carrinhos abertos*
--   7 clientes · 847 cópias · *R$ 1.931,93*
--
--   `HOJE`
--   *Jéssica Caroline Pabst* · R$ 708,80
--   410 cópias · (47) 99708-7417
--
--   `HÁ 26 DIAS`
--   *Isadora Ribeiro* · R$ 105,00
--   30 cópias · isadora@gmail.com
--   ⚠️ apaga dia 20/12
--
-- No mesmo dia, maior valor primeiro. Acima de 10 clientes, os mais antigos viram "+N".
-- Valor sem frete nem cupom, com faixa e perfil (ver 2026-11-24_whatsapp_carrinhos_valor.sql).

create or replace function monitor.carts_text() returns text
language sql stable as $$
  with fotos as (
    select p.user_id, p.product_id, p.quantity, p.created_at
      from public.photos p
      join public.profiles pr on pr.id = p.user_id
      join public.products prod on prod.id = p.product_id and prod.active
     where p.order_id is null and not pr.is_admin
       and exists (select 1 from storage.objects o where o.name = p.storage_key)
  ),
  por_tamanho as (
    select f.user_id, f.product_id, sum(f.quantity) as copias
      from fotos f
     group by 1, 2
  ),
  precos as (
    select t.user_id, t.copias,
           t.copias * least(
             coalesce(pp.price_cents, prod.price_cents),
             (select min((tier ->> 'price_cents')::int)
                from jsonb_array_elements(coalesce(pp.price_tiers, prod.price_tiers)) tier
               where (tier ->> 'min')::int <= t.copias)
           ) as valor
      from por_tamanho t
      join public.products prod on prod.id = t.product_id
      left join public.customer_price_profiles cpp on cpp.user_id = t.user_id
      left join public.profile_prices pp on pp.profile_id = cpp.profile_id and pp.product_id = t.product_id
  ),
  carts as (
    select pr.user_id, sum(pr.copias) as copias, sum(pr.valor) as valor,
           (select (max(f.created_at) at time zone 'America/Sao_Paulo')::date
              from fotos f where f.user_id = pr.user_id) as ultimo
      from precos pr
     group by pr.user_id
  ),
  ranked as (
    select c.*, row_number() over (order by c.ultimo desc, c.valor desc) as n,
           (now() at time zone 'America/Sao_Paulo')::date - c.ultimo as dias,
           c.ultimo + 30 as apaga  -- CART_RETENTION_DAYS em src/lib/cart-retention.ts
      from carts c
  ),
  linhas as (
    select r.n, r.ultimo, r.dias,
           concat_ws(E'\n',
             format('*%s* · %s', coalesce(nullif(trim(pr.full_name), ''), u.email), monitor.fmt_money(r.valor::bigint)),
             format('%s · %s',
               r.copias || case when r.copias = 1 then ' cópia' else ' cópias' end,
               coalesce(monitor.fmt_phone(pr.whatsapp), u.email)),
             case when r.apaga - (now() at time zone 'America/Sao_Paulo')::date <= 5
                  then '⚠️ apaga dia ' || to_char(r.apaga, 'DD/MM') end) as texto
      from ranked r
      join auth.users u on u.id = r.user_id
      left join public.profiles pr on pr.id = r.user_id
     where r.n <= 10
  ),
  dias as (
    select ultimo,
           '`' || case min(dias) when 0 then 'HOJE' when 1 then 'ONTEM' else 'HÁ ' || min(dias) || ' DIAS' end
               || E'`\n' || string_agg(texto, E'\n\n' order by n) as bloco
      from linhas
     group by ultimo
  ),
  totais as (
    select count(*) as clientes, sum(copias) as copias, sum(valor) as valor from ranked
  )
  select concat_ws(E'\n\n',
    format(E'🛒 *Carrinhos abertos*\n%s · %s · *%s*',
      case when t.clientes = 1 then '1 cliente' else t.clientes || ' clientes' end,
      case when t.copias = 1 then '1 cópia' else t.copias || ' cópias' end,
      monitor.fmt_money(t.valor::bigint)),
    (select string_agg(bloco, E'\n\n' order by ultimo desc) from dias),
    case when t.clientes > 10 then format('_+%s mais antigos_', t.clientes - 10) end)
  from totais t
  where t.clientes > 0
$$;

revoke all on all functions in schema monitor from public, anon, authenticated;
