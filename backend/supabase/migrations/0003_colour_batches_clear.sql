-- "Clear all" on the Tom Brown p-chart archives batches instead of deleting
-- them: cleared rows are hidden from the chart but kept so they can be
-- retrieved or restored. Every row cleared by one action shares the same
-- cleared_at timestamp, which identifies that clear for a restore.

alter table public.colour_batches
  add column if not exists cleared_at timestamptz;

create index if not exists colour_batches_cleared_at_idx
  on public.colour_batches (cleared_at);
