-- Resumo diário dos carrinhos: ordem pela data do último envio, do mais antigo para o mais recente
-- (quem está parado há mais tempo aparece primeiro). Desempate pelo valor.
-- Acima de 8 clientes, os mais recentes ficam no "+N".
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
    select c.*, row_number() over (order by c.ultimo, c.valor desc) as n,
           (now() at time zone 'America/Sao_Paulo')::date - c.ultimo as dias,
           c.ultimo + 30 as apaga  -- CART_RETENTION_DAYS em src/lib/cart-retention.ts
      from carts c
  )
  select concat_ws(E'\n',
    format('🛒 *Carrinhos abertos* · %s · %s',
      case when count(*) = 1 then '1 cliente' else count(*) || ' clientes' end,
      monitor.fmt_money(sum(valor)::bigint)),
    string_agg(
      concat_ws(E'\n',
        concat_ws(' · ',
          '• *' || coalesce(nullif(trim(pr.full_name), ''), u.email) || '*',
          r.copias || case when r.copias = 1 then ' cópia' else ' cópias' end,
          monitor.fmt_money(r.valor::bigint),
          case r.dias when 0 then 'hoje' when 1 then 'ontem' else 'há ' || r.dias || ' dias' end,
          case when r.apaga - (now() at time zone 'America/Sao_Paulo')::date <= 5
               then 'apaga dia ' || to_char(r.apaga, 'DD/MM') end),
        '  ' || coalesce(monitor.fmt_phone(pr.whatsapp), u.email)),
      E'\n' order by r.n) filter (where r.n <= 8),
    case when count(*) > 8 then format('+%s mais recentes', count(*) - 8) end)
  from ranked r
  join auth.users u on u.id = r.user_id
  left join public.profiles pr on pr.id = r.user_id
  having count(*) > 0
$$;

revoke all on all functions in schema monitor from public, anon, authenticated;
