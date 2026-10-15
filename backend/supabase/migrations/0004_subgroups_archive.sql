-- Uploading a spreadsheet replaces the active subgroup set: the previous
-- subgroups are archived (archived_at set) rather than deleted, so they stop
-- counting toward the charts and calculations but can still be viewed or
-- restored. Subgroups archived by one action share the same archived_at.

alter table public.subgroups
  add column if not exists archived_at timestamptz;

create index if not exists subgroups_archived_at_idx
  on public.subgroups (archived_at);
