-- Facility-scoped Testing Days are separate from workouts. Coaches/admins can
-- define an ordered battery and snapshot a deduplicated roster from any number
-- of groups plus individually selected members. Result-entry authorization is
-- intentionally deferred; no authenticated role receives result write access.

begin;

create table public.testing_test_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  description text,
  unit text not null default '',
  input_type text not null check (input_type in ('number', 'time', 'text')),
  ranking_direction text not null default 'none'
    check (ranking_direction in ('higher', 'lower', 'none')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index testing_test_templates_identity_idx
on public.testing_test_templates (facility_id, lower(name), lower(unit));

create table public.testing_days (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  description text,
  testing_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testing_days_facility_date_idx
on public.testing_days (facility_id, testing_date desc);

create table public.testing_day_tests (
  id uuid primary key default gen_random_uuid(),
  testing_day_id uuid not null references public.testing_days(id) on delete cascade,
  test_template_id uuid references public.testing_test_templates(id) on delete set null,
  name text not null,
  description text,
  unit text not null default '',
  input_type text not null check (input_type in ('number', 'time', 'text')),
  ranking_direction text not null default 'none'
    check (ranking_direction in ('higher', 'lower', 'none')),
  test_order integer not null check (test_order >= 0),
  created_at timestamptz not null default now(),
  unique (testing_day_id, test_order)
);

create index testing_day_tests_day_idx
on public.testing_day_tests (testing_day_id, test_order);

create table public.testing_day_groups (
  testing_day_id uuid not null references public.testing_days(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (testing_day_id, group_id)
);

create table public.testing_day_participants (
  id uuid primary key default gen_random_uuid(),
  testing_day_id uuid not null references public.testing_days(id) on delete cascade,
  member_profile_id uuid not null references public.member_profiles(id) on delete restrict,
  selected_individually boolean not null default false,
  created_at timestamptz not null default now(),
  unique (testing_day_id, member_profile_id)
);

create index testing_day_participants_member_idx
on public.testing_day_participants (member_profile_id, testing_day_id);

create table public.testing_results (
  id uuid primary key default gen_random_uuid(),
  testing_day_test_id uuid not null references public.testing_day_tests(id) on delete cascade,
  testing_day_participant_id uuid not null references public.testing_day_participants(id) on delete cascade,
  numeric_value numeric,
  text_value text,
  notes text,
  entered_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (testing_day_test_id, testing_day_participant_id),
  check (numeric_value is not null or nullif(btrim(text_value), '') is not null)
);

create or replace function app_private.require_testing_result_same_day()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  test_day_id uuid;
  participant_day_id uuid;
begin
  select testing_day_id into test_day_id
  from public.testing_day_tests
  where id = new.testing_day_test_id;

  select testing_day_id into participant_day_id
  from public.testing_day_participants
  where id = new.testing_day_participant_id;

  if test_day_id is null or participant_day_id is null or test_day_id <> participant_day_id then
    raise exception 'Testing result test and participant must belong to the same Testing Day.';
  end if;

  return new;
end;
$$;

create trigger require_testing_result_same_day
before insert or update on public.testing_results
for each row execute function app_private.require_testing_result_same_day();

create or replace function app_private.testing_day_facility_id(check_testing_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select td.facility_id
  from public.testing_days td
  where td.id = check_testing_day_id
  limit 1;
$$;

create or replace function app_private.testing_day_test_facility_id(check_test_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select td.facility_id
  from public.testing_day_tests tdt
  join public.testing_days td on td.id = tdt.testing_day_id
  where tdt.id = check_test_id
  limit 1;
$$;

create or replace function app_private.testing_participant_facility_id(check_participant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select td.facility_id
  from public.testing_day_participants tdp
  join public.testing_days td on td.id = tdp.testing_day_id
  where tdp.id = check_participant_id
  limit 1;
$$;

create or replace function app_private.can_view_testing_day(check_testing_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.testing_days td
    where td.id = check_testing_day_id
      and (
        app_private.is_facility_coach(td.facility_id)
        or (
          td.status in ('scheduled', 'completed')
          and exists (
            select 1
            from public.testing_day_participants tdp
            where tdp.testing_day_id = td.id
              and app_private.owns_member_profile(tdp.member_profile_id)
          )
        )
      )
  );
$$;

alter table public.testing_test_templates enable row level security;
alter table public.testing_days enable row level security;
alter table public.testing_day_tests enable row level security;
alter table public.testing_day_groups enable row level security;
alter table public.testing_day_participants enable row level security;
alter table public.testing_results enable row level security;

create policy "testing templates coaches read facility templates"
on public.testing_test_templates for select to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "testing templates coaches create facility templates"
on public.testing_test_templates for insert to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_by = auth.uid()
);

create policy "testing templates coaches update facility templates"
on public.testing_test_templates for update to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "testing days authorized users read"
on public.testing_days for select to authenticated
using (app_private.can_view_testing_day(id));

create policy "testing day tests authorized users read"
on public.testing_day_tests for select to authenticated
using (app_private.can_view_testing_day(testing_day_id));

create policy "testing day groups coaches read"
on public.testing_day_groups for select to authenticated
using (app_private.is_facility_coach(app_private.testing_day_facility_id(testing_day_id)));

create policy "testing participants coaches or assigned member read"
on public.testing_day_participants for select to authenticated
using (
  app_private.is_facility_coach(app_private.testing_day_facility_id(testing_day_id))
  or (
    app_private.owns_member_profile(member_profile_id)
    and app_private.can_view_testing_day(testing_day_id)
  )
);

-- Result viewing is coach/admin-only until member result visibility is approved.
-- No INSERT/UPDATE/DELETE policy exists because result-entry ownership is the
-- one intentionally unresolved Testing Day product decision.
create policy "testing results coaches read facility results"
on public.testing_results for select to authenticated
using (
  app_private.is_facility_coach(
    app_private.testing_day_test_facility_id(testing_day_test_id)
  )
  and app_private.testing_day_test_facility_id(testing_day_test_id) =
    app_private.testing_participant_facility_id(testing_day_participant_id)
);

create or replace function public.save_testing_day(
  p_testing_day_id uuid,
  p_name text,
  p_description text,
  p_testing_date date,
  p_status text,
  p_group_ids uuid[],
  p_member_profile_ids uuid[],
  p_tests jsonb
)
returns table (
  testing_day_id uuid,
  participant_count integer,
  test_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_facility_id uuid;
  saved_day_id uuid;
  test_row jsonb;
  template_id uuid;
  next_order integer := 0;
  normalized_group_ids uuid[] := coalesce(p_group_ids, array[]::uuid[]);
  normalized_member_ids uuid[] := coalesce(p_member_profile_ids, array[]::uuid[]);
begin
  select fm.facility_id
    into caller_facility_id
  from public.facility_members fm
  where fm.profile_id = auth.uid()
    and fm.status = 'approved'
    and fm.role in ('coach', 'admin')
  limit 1;

  if caller_facility_id is null then
    raise exception 'Approved coach or admin access is required.';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Testing Day name is required.';
  end if;

  if p_testing_date is null then
    raise exception 'Testing date is required.';
  end if;

  if p_status not in ('draft', 'scheduled') then
    raise exception 'Testing Days can only be saved as draft or scheduled from the editor.';
  end if;

  if jsonb_typeof(p_tests) <> 'array' or jsonb_array_length(p_tests) = 0 then
    raise exception 'At least one test is required.';
  end if;

  if exists (
    select 1
    from unnest(normalized_group_ids) selected_group_id
    left join public.groups g on g.id = selected_group_id
    where g.id is null or g.facility_id <> caller_facility_id
  ) then
    raise exception 'Every selected group must belong to the coach facility.';
  end if;

  if exists (
    select 1
    from unnest(normalized_member_ids) selected_member_id
    left join public.member_profiles mp on mp.id = selected_member_id
    left join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id is null
      or fm.facility_id <> caller_facility_id
      or fm.status <> 'approved'
      or fm.role not in ('athlete', 'h2k_member')
  ) then
    raise exception 'Every selected member must be an approved member of the coach facility.';
  end if;

  if p_testing_day_id is null then
    insert into public.testing_days (
      facility_id, name, description, testing_date, status, created_by
    ) values (
      caller_facility_id,
      btrim(p_name),
      nullif(btrim(coalesce(p_description, '')), ''),
      p_testing_date,
      p_status,
      auth.uid()
    )
    returning id into saved_day_id;
  else
    select td.id into saved_day_id
    from public.testing_days td
    where td.id = p_testing_day_id
      and td.facility_id = caller_facility_id
      and td.status in ('draft', 'scheduled')
    for update;

    if saved_day_id is null then
      raise exception 'Testing Day is unavailable or cannot be edited.';
    end if;

    if exists (
      select 1
      from public.testing_results tr
      join public.testing_day_tests tdt on tdt.id = tr.testing_day_test_id
      where tdt.testing_day_id = saved_day_id
    ) then
      raise exception 'A Testing Day with saved results cannot be restructured.';
    end if;

    update public.testing_days
    set name = btrim(p_name),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        testing_date = p_testing_date,
        status = p_status,
        updated_at = now()
    where id = saved_day_id;

    delete from public.testing_day_groups where testing_day_id = saved_day_id;
    delete from public.testing_day_participants where testing_day_id = saved_day_id;
    delete from public.testing_day_tests where testing_day_id = saved_day_id;
  end if;

  insert into public.testing_day_groups (testing_day_id, group_id)
  select saved_day_id, selected_group_id
  from (select distinct unnest(normalized_group_ids) as selected_group_id) selected
  where selected_group_id is not null;

  insert into public.testing_day_participants (
    testing_day_id, member_profile_id, selected_individually
  )
  select saved_day_id, candidates.member_profile_id, bool_or(candidates.selected_individually)
  from (
    select gm.member_profile_id, false as selected_individually
    from public.group_members gm
    join public.member_profiles mp on mp.id = gm.member_profile_id
    join public.facility_members fm on fm.id = mp.facility_member_id
    where gm.group_id = any(normalized_group_ids)
      and fm.facility_id = caller_facility_id
      and fm.status = 'approved'
      and fm.role in ('athlete', 'h2k_member')

    union all

    select selected_member_id, true
    from unnest(normalized_member_ids) selected_member_id
    where selected_member_id is not null
  ) candidates
  group by candidates.member_profile_id;

  if not exists (
    select 1 from public.testing_day_participants where testing_day_id = saved_day_id
  ) then
    raise exception 'Select at least one group with approved members or one individual member.';
  end if;

  for test_row in select value from jsonb_array_elements(p_tests)
  loop
    if nullif(btrim(test_row->>'name'), '') is null then
      raise exception 'Every test requires a name.';
    end if;

    if coalesce(test_row->>'input_type', '') not in ('number', 'time', 'text') then
      raise exception 'Every test requires a supported input type.';
    end if;

    if coalesce(test_row->>'ranking_direction', '') not in ('higher', 'lower', 'none') then
      raise exception 'Every test requires a supported ranking direction.';
    end if;

    template_id := null;

    select ttt.id into template_id
    from public.testing_test_templates ttt
    where ttt.facility_id = caller_facility_id
      and lower(ttt.name) = lower(btrim(test_row->>'name'))
      and lower(ttt.unit) = lower(btrim(coalesce(test_row->>'unit', '')))
    limit 1;

    if template_id is null then
      insert into public.testing_test_templates (
        facility_id, name, description, unit, input_type,
        ranking_direction, created_by
      ) values (
        caller_facility_id,
        btrim(test_row->>'name'),
        nullif(btrim(coalesce(test_row->>'description', '')), ''),
        btrim(coalesce(test_row->>'unit', '')),
        test_row->>'input_type',
        test_row->>'ranking_direction',
        auth.uid()
      )
      on conflict do nothing
      returning id into template_id;

      if template_id is null then
        select ttt.id into template_id
        from public.testing_test_templates ttt
        where ttt.facility_id = caller_facility_id
          and lower(ttt.name) = lower(btrim(test_row->>'name'))
          and lower(ttt.unit) = lower(btrim(coalesce(test_row->>'unit', '')))
        limit 1;
      end if;
    end if;

    insert into public.testing_day_tests (
      testing_day_id, test_template_id, name, description, unit,
      input_type, ranking_direction, test_order
    ) values (
      saved_day_id,
      template_id,
      btrim(test_row->>'name'),
      nullif(btrim(coalesce(test_row->>'description', '')), ''),
      btrim(coalesce(test_row->>'unit', '')),
      test_row->>'input_type',
      test_row->>'ranking_direction',
      next_order
    );

    next_order := next_order + 1;
  end loop;

  return query
  select
    saved_day_id,
    (select count(*)::integer from public.testing_day_participants where testing_day_id = saved_day_id),
    (select count(*)::integer from public.testing_day_tests where testing_day_id = saved_day_id);
end;
$$;

create or replace function public.set_testing_day_status(
  p_testing_day_id uuid,
  p_status text
)
returns public.testing_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_day public.testing_days;
begin
  if p_status not in ('draft', 'scheduled', 'completed', 'cancelled') then
    raise exception 'Unsupported Testing Day status.';
  end if;

  update public.testing_days td
  set status = p_status,
      updated_at = now()
  where td.id = p_testing_day_id
    and app_private.is_facility_coach(td.facility_id)
  returning td.* into saved_day;

  if saved_day.id is null then
    raise exception 'Testing Day is unavailable.';
  end if;

  return saved_day;
end;
$$;

create or replace function public.delete_testing_day(p_testing_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.testing_results tr
    join public.testing_day_tests tdt on tdt.id = tr.testing_day_test_id
    where tdt.testing_day_id = p_testing_day_id
  ) then
    raise exception 'Testing Days with saved results cannot be deleted.';
  end if;

  delete from public.testing_days td
  where td.id = p_testing_day_id
    and td.status in ('draft', 'cancelled')
    and app_private.is_facility_coach(td.facility_id);

  if not found then
    raise exception 'Only an available draft or cancelled Testing Day can be deleted.';
  end if;
end;
$$;

grant select, insert, update on public.testing_test_templates to authenticated;
grant select on public.testing_days to authenticated;
grant select on public.testing_day_tests to authenticated;
grant select on public.testing_day_groups to authenticated;
grant select on public.testing_day_participants to authenticated;
grant select on public.testing_results to authenticated;

revoke insert, update, delete on public.testing_days from authenticated;
revoke insert, update, delete on public.testing_day_tests from authenticated;
revoke insert, update, delete on public.testing_day_groups from authenticated;
revoke insert, update, delete on public.testing_day_participants from authenticated;
revoke insert, update, delete on public.testing_results from authenticated;

revoke all on function public.save_testing_day(uuid, text, text, date, text, uuid[], uuid[], jsonb) from public;
revoke all on function public.set_testing_day_status(uuid, text) from public;
revoke all on function public.delete_testing_day(uuid) from public;
grant execute on function public.save_testing_day(uuid, text, text, date, text, uuid[], uuid[], jsonb) to authenticated;
grant execute on function public.set_testing_day_status(uuid, text) to authenticated;
grant execute on function public.delete_testing_day(uuid) to authenticated;

commit;
