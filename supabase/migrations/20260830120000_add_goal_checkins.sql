-- Goal check-ins: lightweight per-goal progress history for member dashboards.

create table if not exists public.goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  member_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  recorded_date date not null default current_date,
  value numeric not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (goal_id, recorded_date)
);

create index if not exists goal_checkins_goal_date_idx
  on public.goal_checkins(goal_id, recorded_date);

create index if not exists goal_checkins_member_date_idx
  on public.goal_checkins(member_profile_id, recorded_date);

alter table public.goal_checkins enable row level security;

grant select, insert, update, delete on public.goal_checkins to authenticated;

drop policy if exists "goal_checkins members and coaches can read checkins" on public.goal_checkins;
drop policy if exists "goal_checkins members can insert own checkins" on public.goal_checkins;
drop policy if exists "goal_checkins coaches can insert facility checkins" on public.goal_checkins;
drop policy if exists "goal_checkins members can update own checkins" on public.goal_checkins;
drop policy if exists "goal_checkins coaches can update facility checkins" on public.goal_checkins;
drop policy if exists "goal_checkins members can delete own checkins" on public.goal_checkins;
drop policy if exists "goal_checkins coaches can delete facility checkins" on public.goal_checkins;

create policy "goal_checkins members and coaches can read checkins"
on public.goal_checkins
for select
to authenticated
using (app_private.can_view_member_profile(member_profile_id));

create policy "goal_checkins members can insert own checkins"
on public.goal_checkins
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.goals g
    where g.id = goal_id
      and g.member_profile_id = member_profile_id
  )
);

create policy "goal_checkins coaches can insert facility checkins"
on public.goal_checkins
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and exists (
    select 1
    from public.goals g
    where g.id = goal_id
      and g.member_profile_id = member_profile_id
  )
);

create policy "goal_checkins members can update own checkins"
on public.goal_checkins
for update
to authenticated
using (app_private.owns_member_profile(member_profile_id))
with check (app_private.owns_member_profile(member_profile_id));

create policy "goal_checkins coaches can update facility checkins"
on public.goal_checkins
for update
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)))
with check (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

create policy "goal_checkins members can delete own checkins"
on public.goal_checkins
for delete
to authenticated
using (app_private.owns_member_profile(member_profile_id));

create policy "goal_checkins coaches can delete facility checkins"
on public.goal_checkins
for delete
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));
