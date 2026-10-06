-- Mark exercise defaults and saved workout snapshots as unilateral.
-- Members still record one result per set; the flag clarifies that the
-- prescribed reps apply independently to both sides.

alter table public.exercise_templates
  add column if not exists is_unilateral boolean not null default false;

alter table public.workout_exercises
  add column if not exists is_unilateral boolean not null default false;

comment on column public.exercise_templates.is_unilateral is
  'Default indicating that prescribed reps apply to each side.';

comment on column public.workout_exercises.is_unilateral is
  'Workout snapshot indicating that prescribed reps apply to each side.';
