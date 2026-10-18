-- Códigos de cupom digitados que não existem, para limitar tentativas (um código curto dá para adivinhar
-- tentando em sequência). /api/cupom e o checkout contam por cliente e por endereço de internet.
create table if not exists public.coupon_misses (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists coupon_misses_user_idx on public.coupon_misses (user_id, created_at);
create index if not exists coupon_misses_ip_idx on public.coupon_misses (ip, created_at);

-- Sem políticas: só o servidor (service role) lê e grava.
alter table public.coupon_misses enable row level security;
revoke all on public.coupon_misses from anon, authenticated;

-- Só a última meia hora importa: o resto é apagado todo dia.
select cron.schedule('limpar-tentativas-cupom', '17 6 * * *', 'delete from public.coupon_misses where created_at < now() - interval ''1 day''');
