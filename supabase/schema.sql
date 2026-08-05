-- Barkoli Trucks & Cars — Stock Tracker schema
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query).

create extension if not exists "pgcrypto";

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  make text not null,
  model text,
  year int,
  vin_plate text,
  purchase_date date,
  buying_price numeric(12,2) not null default 0,
  status text not null default 'in_stock' check (status in ('in_stock','sold')),
  selling_price numeric(12,2),
  sold_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.car_costs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cars_user_id_idx on public.cars(user_id);
create index if not exists car_costs_car_id_idx on public.car_costs(car_id);
create index if not exists car_costs_user_id_idx on public.car_costs(user_id);

alter table public.cars enable row level security;
alter table public.car_costs enable row level security;

drop policy if exists "own cars" on public.cars;
create policy "own cars" on public.cars
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own car_costs" on public.car_costs;
create policy "own car_costs" on public.car_costs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at current on edits.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cars_set_updated_at on public.cars;
create trigger cars_set_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();
