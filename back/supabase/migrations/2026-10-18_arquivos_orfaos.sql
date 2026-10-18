-- Arquivos do bucket sem foto no banco: o envio caiu entre o arquivo e o registro, ou a remoção não
-- conseguiu apagar o arquivo. O job diário (/api/cron/carrinho) apaga pela API do Storage, que é o único
-- jeito de apagar o arquivo de verdade; aqui só lista.
-- Só arquivos da pasta dos clientes (u/) com mais de 2 dias, para nunca pegar um envio em andamento.

create index if not exists photos_storage_key_idx on public.photos (storage_key);
create index if not exists photos_thumb_key_idx on public.photos (thumb_key) where thumb_key is not null;

create or replace function public.orphan_objects(p_bucket text, p_limit integer default 1000)
returns table (name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.name
    from storage.objects o
   where o.bucket_id = p_bucket
     and o.name like 'u/%'
     and o.created_at < now() - interval '2 days'
     and not exists (select 1 from public.photos p where p.storage_key = o.name)
     and not exists (select 1 from public.photos p where p.thumb_key = o.name)
   order by o.created_at
   limit p_limit
$$;

revoke all on function public.orphan_objects(text, integer) from public, anon, authenticated;
grant execute on function public.orphan_objects(text, integer) to service_role;
