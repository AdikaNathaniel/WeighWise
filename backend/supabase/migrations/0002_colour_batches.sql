-- Tom Brown colour p-chart: one row per production batch.
-- Only the raw counts are stored; p, p-bar, sigma and the control limits are
-- recalculated by the spc-engine on every read, so edits and deletes always
-- flow through to every batch's limits.

create table if not exists public.colour_batches (
  id uuid primary key default gen_random_uuid(),
  batch_label text not null check (char_length(batch_label) between 1 and 64),
  production_date date,
  samples_inspected integer not null check (samples_inspected >= 1),
  nonconforming integer not null check (nonconforming >= 0),
  created_at timestamptz not null default now(),
  constraint colour_batches_nonconforming_le_samples check (nonconforming <= samples_inspected)
);

create index if not exists colour_batches_production_date_idx
  on public.colour_batches (production_date, created_at);

alter table public.colour_batches enable row level security;

-- Same access model as 0001: only the backend (service_role) touches this table.
