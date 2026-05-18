-- AG-PILOTO - Supabase Schema (Luanda Mobility & Logistics)
-- Core goals:
-- 1) ACID wallet operations for payments.
-- 2) RLS-first multi-tenant security model.
-- 3) Taxi/Family/Freight services with extensible pricing rules.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create type public.user_role as enum ('passenger', 'driver', 'admin');
create type public.service_type as enum ('taxi', 'family', 'freight');
create type public.trip_status as enum (
  'requested',
  'matched',
  'driver_arriving',
  'in_progress',
  'completed',
  'cancelled'
);
create type public.recurrence_type as enum ('daily', 'weekly', 'monthly');
create type public.wallet_transaction_type as enum (
  'trip_charge',
  'trip_payout',
  'wallet_topup',
  'wallet_withdrawal',
  'adjustment'
);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text unique not null,
  email text unique,
  role public.user_role not null default 'passenger',
  is_active boolean not null default true,
  encrypted_document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  user_id uuid primary key references public.users (id) on delete cascade,
  license_number text not null unique,
  vehicle_type text not null,
  vehicle_plate text not null unique,
  is_online boolean not null default false,
  current_service public.service_type[] not null default array['taxi']::public.service_type[],
  rating numeric(3, 2) not null default 5.0 check (rating between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code public.service_type not null unique,
  display_name text not null,
  base_fare numeric(12, 2) not null check (base_fare >= 0),
  per_km_rate numeric(12, 2) not null check (per_km_rate >= 0),
  per_minute_rate numeric(12, 2) not null check (per_minute_rate >= 0),
  minimum_fare numeric(12, 2) not null check (minimum_fare >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.users (id),
  driver_id uuid references public.drivers (user_id),
  service_id uuid not null references public.services (id),
  status public.trip_status not null default 'requested',
  origin_address text not null,
  destination_address text not null,
  origin_point geography(point, 4326) not null,
  destination_point geography(point, 4326) not null,
  estimated_distance_km numeric(10, 3) check (estimated_distance_km >= 0),
  estimated_duration_min numeric(10, 2) check (estimated_duration_min >= 0),
  quoted_price numeric(12, 2) not null check (quoted_price >= 0),
  final_price numeric(12, 2) check (final_price >= 0),
  final_route geometry(linestring, 4326),
  requested_at timestamptz not null default now(),
  matched_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_trips_passenger_id on public.trips (passenger_id);
create index if not exists idx_trips_driver_id on public.trips (driver_id);
create index if not exists idx_trips_status on public.trips (status);

create table if not exists public.family_schedules (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.users (id),
  service_id uuid not null references public.services (id),
  recurrence public.recurrence_type not null,
  start_date date not null,
  end_date date,
  pickup_time time not null,
  pickup_address text not null,
  destination_address text not null,
  pickup_point geography(point, 4326) not null,
  destination_point geography(point, 4326) not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists idx_family_schedules_passenger_id on public.family_schedules (passenger_id);

create table if not exists public.freight_details (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  cargo_description text not null,
  weight_kg numeric(10, 2) check (weight_kg >= 0),
  volume_m3 numeric(10, 3) check (volume_m3 >= 0),
  requires_assistant boolean not null default false,
  fragile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  currency_code text not null default 'AOA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  trip_id uuid references public.trips (id),
  tx_type public.wallet_transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_transactions_wallet_id on public.wallet_transactions (wallet_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

create or replace function public.calculate_trip_price(
  p_service_id uuid,
  p_distance_km numeric,
  p_duration_min numeric
)
returns numeric
language plpgsql
stable
as $$
declare
  v_base numeric(12, 2);
  v_per_km numeric(12, 2);
  v_per_min numeric(12, 2);
  v_minimum numeric(12, 2);
  v_total numeric(12, 2);
begin
  select s.base_fare, s.per_km_rate, s.per_minute_rate, s.minimum_fare
  into v_base, v_per_km, v_per_min, v_minimum
  from public.services s
  where s.id = p_service_id
    and s.is_active = true;

  if v_base is null then
    raise exception 'Service not found or inactive';
  end if;

  v_total := v_base
    + coalesce(p_distance_km, 0) * v_per_km
    + coalesce(p_duration_min, 0) * v_per_min;

  return greatest(v_total, v_minimum);
end;
$$;

create or replace function public.wallet_transfer(
  p_from_user uuid,
  p_to_user uuid,
  p_amount numeric,
  p_trip_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select *
  into v_from_wallet
  from public.wallets
  where user_id = p_from_user
  for update;

  select *
  into v_to_wallet
  from public.wallets
  where user_id = p_to_user
  for update;

  if v_from_wallet.id is null or v_to_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  if v_from_wallet.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets
  set balance = balance - p_amount
  where id = v_from_wallet.id;

  update public.wallets
  set balance = balance + p_amount
  where id = v_to_wallet.id;

  insert into public.wallet_transactions (wallet_id, trip_id, tx_type, amount, metadata)
  values
    (v_from_wallet.id, p_trip_id, 'trip_charge', p_amount, jsonb_build_object('counterparty_user_id', p_to_user)),
    (v_to_wallet.id, p_trip_id, 'trip_payout', p_amount, jsonb_build_object('counterparty_user_id', p_from_user));
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Novo Utilizador'),
    coalesce(new.raw_user_meta_data ->> 'phone', concat('temp-', new.id::text)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'passenger')
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at before update on public.drivers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at before update on public.trips
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_family_schedules_updated_at on public.family_schedules;
create trigger trg_family_schedules_updated_at before update on public.family_schedules
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_freight_details_updated_at on public.freight_details;
create trigger trg_freight_details_updated_at before update on public.freight_details
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at before update on public.wallets
for each row execute procedure public.set_updated_at();

alter table public.users enable row level security;
alter table public.drivers enable row level security;
alter table public.services enable row level security;
alter table public.trips enable row level security;
alter table public.family_schedules enable row level security;
alter table public.freight_details enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select using (id = auth.uid() or public.is_admin());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists drivers_read on public.drivers;
create policy drivers_read on public.drivers
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists drivers_update_own on public.drivers;
create policy drivers_update_own on public.drivers
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists services_read_all on public.services;
create policy services_read_all on public.services
for select using (true);

drop policy if exists trips_insert_by_passenger on public.trips;
create policy trips_insert_by_passenger on public.trips
for insert with check (passenger_id = auth.uid() or public.is_admin());

drop policy if exists trips_read_participants on public.trips;
create policy trips_read_participants on public.trips
for select using (
  passenger_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_admin()
);

drop policy if exists trips_update_participants on public.trips;
create policy trips_update_participants on public.trips
for update using (
  passenger_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_admin()
)
with check (
  passenger_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_admin()
);

drop policy if exists family_schedule_owner_rw on public.family_schedules;
create policy family_schedule_owner_rw on public.family_schedules
for all using (passenger_id = auth.uid() or public.is_admin())
with check (passenger_id = auth.uid() or public.is_admin());

drop policy if exists freight_details_participants_rw on public.freight_details;
create policy freight_details_participants_rw on public.freight_details
for all using (
  exists (
    select 1
    from public.trips t
    where t.id = freight_details.trip_id
      and (t.passenger_id = auth.uid() or t.driver_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = freight_details.trip_id
      and (t.passenger_id = auth.uid() or t.driver_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists wallets_select_owner on public.wallets;
create policy wallets_select_owner on public.wallets
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists wallets_update_admin_only on public.wallets;
create policy wallets_update_admin_only on public.wallets
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists wallet_transactions_select_owner on public.wallet_transactions;
create policy wallet_transactions_select_owner on public.wallet_transactions
for select using (
  exists (
    select 1
    from public.wallets w
    where w.id = wallet_transactions.wallet_id
      and (w.user_id = auth.uid() or public.is_admin())
  )
);

insert into public.services (code, display_name, base_fare, per_km_rate, per_minute_rate, minimum_fare)
values
  ('taxi', 'Taxi', 650, 180, 40, 900),
  ('family', 'Familiar', 500, 150, 30, 800),
  ('freight', 'Cupapata Frete', 900, 220, 45, 1200)
on conflict (code) do update
set
  display_name = excluded.display_name,
  base_fare = excluded.base_fare,
  per_km_rate = excluded.per_km_rate,
  per_minute_rate = excluded.per_minute_rate,
  minimum_fare = excluded.minimum_fare,
  updated_at = now();
