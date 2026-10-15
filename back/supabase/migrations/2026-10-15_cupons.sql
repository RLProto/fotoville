-- Aba Cupons do painel: cupons de desconto percentual criados pela loja.
--
-- Um uso é um pedido com o cupom que não foi cancelado (pedido aguardando pagamento também conta:
-- segura o cupom até ser pago ou cancelado). Cancelar o pedido devolve o uso.
alter table public.coupons
  add column if not exists description text,
  add column if not exists min_order_cents integer not null default 0 check (min_order_cents >= 0),
  add column if not exists max_uses integer check (max_uses > 0),               -- null: sem limite
  add column if not exists once_per_customer boolean not null default false;

-- Código criado no painel: só letras maiúsculas e números, de 3 a 20 (o de pacote é gerado, FV-XXXX-XXXX)
alter table public.coupons drop constraint if exists coupons_percent_code_check;
alter table public.coupons add constraint coupons_percent_code_check
  check (kind <> 'percent' or code ~ '^[A-Z0-9]{3,20}$');

create index if not exists coupon_redemptions_code_idx on public.coupon_redemptions (code);

-- Por que o cupom percentual não vale para este cliente e este subtotal, ou null se vale.
-- Respostas: not_found, inactive, expired, min_order, limit, customer.
create or replace function public.coupon_problem(p_code text, p_user uuid, p_subtotal integer)
returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  c public.coupons;
begin
  select * into c from public.coupons where code = p_code and kind = 'percent';
  if not found then return 'not_found'; end if;
  if not c.active then return 'inactive'; end if;
  if c.expires_at is not null and c.expires_at <= now() then return 'expired'; end if;
  if p_subtotal < c.min_order_cents then return 'min_order'; end if;
  if c.max_uses is not null and (
    select count(*) from public.coupon_redemptions r join public.orders o on o.id = r.order_id
     where r.code = p_code and o.status <> 'cancelled'
  ) >= c.max_uses then return 'limit'; end if;
  if c.once_per_customer and exists (
    select 1 from public.coupon_redemptions r join public.orders o on o.id = r.order_id
     where r.code = p_code and o.status <> 'cancelled' and o.user_id = p_user
  ) then return 'customer'; end if;
  return null;
end;
$$;

-- Registra o uso do cupom no pedido, conferindo tudo de novo com o cupom travado:
-- dois pedidos ao mesmo tempo não passam do limite. Devolve null se registrou, senão o problema.
create or replace function public.redeem_percent_coupon(p_code text, p_order uuid, p_subtotal integer, p_discount integer)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  problem text;
begin
  perform 1 from public.coupons where code = p_code for update;
  problem := public.coupon_problem(p_code, (select user_id from public.orders where id = p_order), p_subtotal);
  if problem is not null then return problem; end if;
  insert into public.coupon_redemptions (code, order_id, credits, discount_cents) values (p_code, p_order, 0, p_discount);
  return null;
end;
$$;

revoke all on function public.coupon_problem(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.redeem_percent_coupon(text, uuid, integer, integer) from public, anon, authenticated;
