-- Signal reviews (Review Signal design guide). Every investigated signal is
-- now recorded, not only the ones that end in an exclusion:
--   outcome   confirmed | possible | none  — what the investigation found
--   excluded  true when the whole subgroup is left out of the revised limits;
--             only a confirmed, evidenced cause may exclude
--   causes    the specific supported causes (several may apply)
--   evidence  what was reviewed (discussion, observation, records, …)
--   follow_up the follow-up action, required when the subgroup is retained
--   reviewer  who carried out the investigation
-- Existing rows were all confirmed exclusions, which the defaults preserve.
-- Reopening a review still sets reverted_at, so the table remains the audit
-- history and at most one review per subgroup is active.

alter table public.subgroup_exclusions
  add column if not exists outcome text not null default 'confirmed'
    check (outcome in ('confirmed', 'possible', 'none')),
  add column if not exists excluded boolean not null default true,
  add column if not exists causes text[] not null default '{}',
  add column if not exists evidence text[] not null default '{}',
  add column if not exists follow_up text,
  add column if not exists reviewer text;

-- A retained subgroup with no confirmed cause has no category, cause,
-- findings or corrective action to record.
alter table public.subgroup_exclusions
  alter column category drop not null,
  alter column cause drop not null,
  alter column found drop not null,
  alter column corrective_action drop not null;

update public.subgroup_exclusions
  set causes = array[cause]
  where cardinality(causes) = 0 and cause is not null;

alter table public.subgroup_exclusions
  drop constraint if exists subgroup_exclusions_exclusion_is_confirmed;
alter table public.subgroup_exclusions
  add constraint subgroup_exclusions_exclusion_is_confirmed check (
    not excluded or (
      outcome = 'confirmed'
      and category is not null
      and cardinality(causes) > 0
      and found is not null
      and corrective_action is not null
    )
  );

-- Package weights must be positive. NOT VALID leaves any existing rows alone
-- while every new or edited sample is checked.
alter table public.samples
  drop constraint if exists samples_weight_positive;
alter table public.samples
  add constraint samples_weight_positive check (weight_g > 0) not valid;
