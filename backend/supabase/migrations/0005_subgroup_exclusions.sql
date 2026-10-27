-- Assignable-cause reviews. When an out-of-control subgroup is investigated
-- and a specific cause is found, the whole subgroup is excluded from the
-- revised X-bar and R chart limits. The subgroup and its samples are never
-- changed: they stay on the trial chart, and this table is the revision
-- history. Reinstating a subgroup sets reverted_at instead of deleting the
-- review, so at most one review per subgroup is active (reverted_at null).

create table if not exists public.subgroup_exclusions (
  id uuid primary key default gen_random_uuid(),
  subgroup_id uuid not null references public.subgroups (id) on delete cascade,
  -- The signal that prompted the review, as seen on the trial chart.
  chart text not null check (chart in ('x-bar', 'r')),
  rule integer not null check (rule between 1 and 8),
  direction text not null,
  value numeric(10, 3) not null,
  limit_type text not null check (limit_type in ('ucl', 'cl', 'lcl')),
  trial_limit numeric(10, 3) not null,
  -- The investigation (cause categories follow the 6M cause-and-effect diagram).
  category text not null,
  cause text not null,
  found text not null,
  corrective_action text not null,
  investigated_on date not null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

create index if not exists subgroup_exclusions_subgroup_id_idx
  on public.subgroup_exclusions (subgroup_id);

create unique index if not exists subgroup_exclusions_one_active_idx
  on public.subgroup_exclusions (subgroup_id)
  where reverted_at is null;

alter table public.subgroup_exclusions enable row level security;
