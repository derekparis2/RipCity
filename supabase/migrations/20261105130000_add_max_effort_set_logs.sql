-- Members flag which logged sets were true max-effort attempts so only those
-- sets feed their calculated lift maxes (used for percent-of-max prescriptions).

alter table public.exercise_set_logs
  add column if not exists is_max_effort boolean not null default false;

comment on column public.exercise_set_logs.is_max_effort is
  'True when the member marked this set as a max-effort attempt. Only these sets count toward calculated maxes.';

create index if not exists exercise_set_logs_member_max_effort_idx
  on public.exercise_set_logs (member_profile_id)
  where is_max_effort;
