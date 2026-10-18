-- Fotos: o cliente logado só grava o que o site grava, mesmo chamando o Supabase direto.
-- Antes, a regra deixava apontar a foto para qualquer arquivo do bucket (e depois ler ou apagar o de
-- outra pessoa) e mudar created_at para o carrinho nunca expirar.

-- Ninguém de fora do servidor grava por anon; truncate e afins não têm uso no site.
revoke insert, update, truncate, references, trigger on public.photos from anon, authenticated;

-- Inserir: só as colunas que POST /api/photos grava. id, created_at, order_id, fit e adjust ficam no padrão.
grant insert (user_id, product_id, storage_key, thumb_key, file_name, width_px, height_px, crop, finish, quantity)
  on public.photos to authenticated;
-- Editar: só o que o editor e as cópias mudam (PATCH /api/photos/[id] e a gravação em lote).
grant update (crop, fit, adjust, finish, quantity) on public.photos to authenticated;

-- O arquivo precisa estar na pasta do próprio cliente (u/<id>/), a mesma que /api/upload/presign assina.
drop policy if exists "fotos proprias - criar" on public.photos;
create policy "fotos proprias - criar" on public.photos
  for insert with check (
    auth.uid() = user_id
    and order_id is null
    and starts_with(storage_key, 'u/' || auth.uid()::text || '/')
    and (thumb_key is null or starts_with(thumb_key, 'u/' || auth.uid()::text || '/'))
  );
