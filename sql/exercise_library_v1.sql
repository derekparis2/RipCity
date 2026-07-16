-- =====================================================
-- EXERCISE LIBRARY V1
-- =====================================================
-- Proposed migration only. Do not run until reviewed in staging/Supabase.
--
-- Purpose:
-- - Let coaches choose standardized exercises instead of typing every name.
-- - Keep exercise names consistent for history, PRs, progress, and future AI.
-- - Allow facility-specific libraries so each tenant controls its own exercise
--   terminology, equipment, videos, and substitution options.
--
-- RLS note:
-- This migration enables RLS, but the main rls_policies_v1.sql file should be
-- updated before production to include policies for these tables. Until then,
-- run this only in a reviewed environment with matching policies.

create table if not exists public.exercise_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,

  name text not null,
  category text,
  equipment text,
  movement_pattern text,
  input_type text not null default 'completion'
    check (input_type in ('weight_reps', 'band_color', 'completion', 'time', 'distance', 'custom')),

  description text,
  video_url text,
  coach_note text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercise_templates_facility_name_idx
  on public.exercise_templates (facility_id, lower(name));

create index if not exists exercise_templates_facility_active_idx
  on public.exercise_templates (facility_id, active, name);

create table if not exists public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  substitute_exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),

  check (exercise_template_id <> substitute_exercise_template_id),
  unique (exercise_template_id, substitute_exercise_template_id)
);

create index if not exists exercise_substitutions_facility_active_idx
  on public.exercise_substitutions (facility_id, active);

alter table public.exercise_templates enable row level security;
alter table public.exercise_substitutions enable row level security;

alter table public.workout_exercises
  add column if not exists exercise_template_id uuid
  references public.exercise_templates(id) on delete set null;

create index if not exists workout_exercises_template_idx
  on public.workout_exercises (exercise_template_id);

-- Coaches/admins can read and manage exercise templates inside their facility.
drop policy if exists "exercise_templates coaches can read facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can insert facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can update facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can delete facility templates" on public.exercise_templates;

create policy "exercise_templates coaches can read facility templates"
on public.exercise_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_templates coaches can insert facility templates"
on public.exercise_templates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
  and created_by = auth.uid()
);

create policy "exercise_templates coaches can update facility templates"
on public.exercise_templates
for update
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_templates coaches can delete facility templates"
on public.exercise_templates
for delete
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

-- Substitution options stay coach-managed for now. Athlete swap UI should read
-- these later, but unrestricted athlete-created substitutions should not be
-- allowed without a product/security pass.
drop policy if exists "exercise_substitutions coaches can read facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can insert facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can update facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can delete facility substitutions" on public.exercise_substitutions;

create policy "exercise_substitutions coaches can read facility substitutions"
on public.exercise_substitutions
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_substitutions coaches can insert facility substitutions"
on public.exercise_substitutions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
  and exists (
    select 1
    from public.exercise_templates original
    join public.exercise_templates substitute
      on substitute.id = exercise_substitutions.substitute_exercise_template_id
    where original.id = exercise_substitutions.exercise_template_id
      and original.facility_id = exercise_substitutions.facility_id
      and substitute.facility_id = exercise_substitutions.facility_id
  )
);

create policy "exercise_substitutions coaches can update facility substitutions"
on public.exercise_substitutions
for update
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_substitutions coaches can delete facility substitutions"
on public.exercise_substitutions
for delete
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

-- Future athlete substitution direction:
-- Add performed_exercise_template_id and substitution_reason to set logs, or
-- create a workout_exercise_substitutions table. Start with coach-approved
-- substitution options, not unrestricted athlete swaps.
