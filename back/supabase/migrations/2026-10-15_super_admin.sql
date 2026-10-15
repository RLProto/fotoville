-- Super admin: vê a aba Erros do painel. Quem administra a loja (is_admin) não vê.
-- Como is_admin, o próprio usuário não altera: a coluna fica fora do grant de update de profiles.
alter table public.profiles add column if not exists is_super_admin boolean not null default false;

update public.profiles set is_admin = true, is_super_admin = true
  where id = (select id from auth.users where email = 'rafaellproto@gmail.com');
