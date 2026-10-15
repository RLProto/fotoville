-- Entrega por motoboy dentro de Joinville: um preço por bairro, editável no painel (aba Motoboy).
-- O cliente só vê a opção quando a cidade do endereço é Joinville e o bairro está nesta lista.
-- district_key é o nome sem acento, minúsculo e com espaços simples: é por ele que o bairro
-- digitado (ou vindo do ViaCEP) é comparado.
create table if not exists public.motoboy_zones (
  id uuid primary key default gen_random_uuid(),
  district text not null check (length(trim(district)) between 2 and 60),
  district_key text not null unique,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sem políticas: só o servidor (service role) lê e grava.
alter table public.motoboy_zones enable row level security;

-- Os 20 bairros mais populosos (Censo 2022, IBGE), a R$ 19,90. Pode rodar de novo: não duplica.
insert into public.motoboy_zones (district, district_key, price_cents)
values
  ('Aventureiro', 'aventureiro', 1990),
  ('Costa e Silva', 'costa e silva', 1990),
  ('Paranaguamirim', 'paranaguamirim', 1990),
  ('Vila Nova', 'vila nova', 1990),
  ('Jardim Iririú', 'jardim iririu', 1990),
  ('Iririú', 'iririu', 1990),
  ('Jardim Paraíso', 'jardim paraiso', 1990),
  ('Floresta', 'floresta', 1990),
  ('Itaum', 'itaum', 1990),
  ('Boa Vista', 'boa vista', 1990),
  ('Comasa', 'comasa', 1990),
  ('Jarivatuba', 'jarivatuba', 1990),
  ('Nova Brasília', 'nova brasilia', 1990),
  ('Bucarein', 'bucarein', 1990),
  ('Centro', 'centro', 1990),
  ('América', 'america', 1990),
  ('Glória', 'gloria', 1990),
  ('Saguaçu', 'saguacu', 1990),
  ('Bom Retiro', 'bom retiro', 1990),
  ('Fátima', 'fatima', 1990)
on conflict (district_key) do nothing;
