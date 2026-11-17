-- Lotes de etiquetas (aba Etiquetas do painel): "Gerar etiquetas" junta num lote os pedidos aprovados; imprimir
-- o lote marca as etiquetas como impressas e passa os aprovados para "Em produção". A etiqueta não depende mais
-- do download das fotos: label_ready_at passa a dizer só que as fotos foram baixadas.
create table if not exists public.label_batches (
  id uuid primary key default gen_random_uuid(),
  number int not null unique, -- maior + 1, dado sob trava em create_label_batch: sem buracos na sequência
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  printed_at timestamptz,
  print_count int not null default 0
);
-- Sem políticas: só o servidor (service role) lê e grava.
alter table public.label_batches enable row level security;

alter table public.orders
  add column if not exists label_batch_id uuid references public.label_batches (id) on delete set null;
create index if not exists orders_label_batch_idx on public.orders (label_batch_id) where label_batch_id is not null;

-- Quem entra no próximo lote: pedido de fotos fora de lote, aprovado, ou já em produção por ter sido baixado
-- pela lista de pedidos antes de ganhar etiqueta. Em produção sem download (pedidos antigos) fica de fora.
create or replace function public.label_batch_candidates()
returns setof uuid
language sql stable set search_path = public, pg_temp as $$
  select o.id
    from public.orders o
   where o.kind = 'prints'
     and o.label_batch_id is null
     and (o.status = 'paid'
          or (o.status = 'in_production' and o.label_ready_at is not null and o.label_printed_at is null))
$$;

-- Cria o lote com todos os candidatos. Sem candidato, não cria nada e não devolve linha.
-- A trava evita que dois cliques (ou dois admins) dividam os mesmos pedidos.
create or replace function public.create_label_batch(p_user uuid)
returns table (id uuid, number int, orders int)
language plpgsql set search_path = public, pg_temp as $$
declare
  b public.label_batches;
  n int;
begin
  perform pg_advisory_xact_lock(hashtext('label_batches'));
  if not exists (select 1 from public.label_batch_candidates()) then
    return;
  end if;
  insert into public.label_batches (number, created_by)
  values ((select coalesce(max(lb.number), 0) + 1 from public.label_batches lb), p_user)
  returning * into b;
  update public.orders o
     set label_batch_id = b.id
   where o.id in (select public.label_batch_candidates());
  get diagnostics n = row_count;
  if n = 0 then
    delete from public.label_batches lb where lb.id = b.id;
    return;
  end if;
  return query select b.id, b.number, n;
end $$;

-- Impressão do lote: marca o lote e as etiquetas e passa os aprovados para "Em produção" (o gatilho do histórico
-- grava a mudança). Devolve os pedidos que mudaram de status; reimprimir não muda nenhum.
create or replace function public.print_label_batch(p_batch uuid)
returns table (id uuid)
language plpgsql set search_path = public, pg_temp as $$
begin
  update public.label_batches lb
     set printed_at = now(), print_count = lb.print_count + 1
   where lb.id = p_batch;
  if not found then
    raise exception 'lote não encontrado' using errcode = 'P0002';
  end if;
  update public.orders o
     set label_printed_at = now()
   where o.label_batch_id = p_batch
     and o.status <> 'cancelled';
  return query
    update public.orders o
       set status = 'in_production'
     where o.label_batch_id = p_batch
       and o.kind = 'prints'
       and o.status = 'paid'
    returning o.id;
end $$;

-- Desfaz o lote antes da primeira impressão: os pedidos voltam para a fila.
create or replace function public.undo_label_batch(p_batch uuid)
returns boolean
language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('label_batches'));
  perform 1 from public.label_batches lb where lb.id = p_batch and lb.printed_at is null;
  if not found then
    return false;
  end if;
  update public.orders o set label_batch_id = null where o.label_batch_id = p_batch;
  delete from public.label_batches lb where lb.id = p_batch;
  return true;
end $$;

revoke all on function public.label_batch_candidates() from public, anon, authenticated;
revoke all on function public.create_label_batch(uuid) from public, anon, authenticated;
revoke all on function public.print_label_batch(uuid) from public, anon, authenticated;
revoke all on function public.undo_label_batch(uuid) from public, anon, authenticated;
grant execute on function public.label_batch_candidates() to service_role;
grant execute on function public.create_label_batch(uuid) to service_role;
grant execute on function public.print_label_batch(uuid) to service_role;
grant execute on function public.undo_label_batch(uuid) to service_role;

-- A seleção avulsa de etiquetas saiu do painel.
drop function if exists public.mark_labels_printed(uuid[]);
