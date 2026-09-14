-- WeighWise SPC schema
-- Run this in the Supabase SQL Editor (public schema was confirmed empty
-- before this migration — see project memory).

create extension if not exists pgcrypto;

create table if not exists public.subgroups (
  id uuid primary key default gen_random_uuid(),
  production_date date not null,
  sample_size integer not null check (sample_size between 2 and 10),
  mean numeric(10, 3) not null,
  range numeric(10, 3) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  subgroup_id uuid not null references public.subgroups (id) on delete cascade,
  sample_index integer not null,
  weight_g numeric(10, 3) not null,
  unique (subgroup_id, sample_index)
);

create index if not exists samples_subgroup_id_idx on public.samples (subgroup_id);
create index if not exists subgroups_production_date_idx on public.subgroups (production_date);

alter table public.subgroups enable row level security;
alter table public.samples enable row level security;

-- All reads/writes go through the NestJS ingestion service using the
-- service_role key, which bypasses RLS. No policies are granted to the
-- anon/authenticated roles, so direct client-side access is blocked by
-- default -- the frontend must go through the backend gateway.
