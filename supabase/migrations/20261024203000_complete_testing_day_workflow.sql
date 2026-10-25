-- Complete the Testing Day lifecycle without giving members result-entry
-- access. Staff can account for absences and skipped tests, members can read
-- only their own official results, and a day can be finished only when every
-- roster/test combination has an explicit outcome.

begin;

alter table public.testing_day_participants
  add column participation_status text not null default 'pending'
  check (participation_status in ('pending', 'participated', 'did_not_participate'));

alter table public.testing_results
  add column result_status text not null default 'recorded'
  check (result_status in ('recorded', 'not_tested'));

alter table public.testing_results
  drop constraint if exists testing_results_check;

alter table public.testing_results
  add constraint testing_results_value_or_status_check check (
    (
      result_status = 'recorded'
      and (numeric_value is not null or nullif(btrim(text_value), '') is not null)
    )
    or (
      result_status = 'not_tested'
      and numeric_value is null
      and nullif(btrim(text_value), '') is null
    )
  );

create or replace function app_private.owns_testing_participant(check_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.testing_day_participants tdp
    join public.testing_days td on td.id = tdp.testing_day_id
    where tdp.id = check_participant_id
      and app_private.owns_member_profile(tdp.member_profile_id)
      and td.status in ('scheduled', 'completed')
  );
$$;

create policy "members read own testing results"
on public.testing_results for select to authenticated
using (
  app_private.owns_testing_participant(testing_day_participant_id)
  and app_private.testing_day_test_facility_id(testing_day_test_id) =
    app_private.testing_participant_facility_id(testing_day_participant_id)
);

create or replace function public.save_testing_results(
  p_testing_day_id uuid,
  p_results jsonb
)
returns table (saved_count integer, deleted_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  result_row jsonb;
  result_test public.testing_day_tests;
  result_participant public.testing_day_participants;
  result_numeric numeric;
  result_text text;
  result_notes text;
  result_state text;
  saved_total integer := 0;
  deleted_total integer := 0;
begin
  if not exists (
    select 1
    from public.testing_days td
    where td.id = p_testing_day_id
      and td.status in ('scheduled', 'completed')
      and app_private.is_facility_coach(td.facility_id)
  ) then
    raise exception 'Testing Day is unavailable for result entry.';
  end if;

  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then
    raise exception 'Testing results must be a JSON array.';
  end if;

  for result_row in select value from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    select tdt.* into result_test
    from public.testing_day_tests tdt
    where tdt.id = (result_row->>'testing_day_test_id')::uuid
      and tdt.testing_day_id = p_testing_day_id;

    select tdp.* into result_participant
    from public.testing_day_participants tdp
    where tdp.id = (result_row->>'testing_day_participant_id')::uuid
      and tdp.testing_day_id = p_testing_day_id;

    if result_test.id is null or result_participant.id is null then
      raise exception 'Every result must use a test and participant from this Testing Day.';
    end if;

    if result_participant.participation_status = 'did_not_participate' then
      raise exception '% is marked as not participating.', result_participant.member_profile_id;
    end if;

    result_state := coalesce(nullif(result_row->>'result_status', ''), 'recorded');
    if result_state not in ('recorded', 'not_tested') then
      raise exception 'Unsupported Testing Day result status.';
    end if;

    result_numeric := nullif(result_row->>'numeric_value', '')::numeric;
    result_text := nullif(btrim(coalesce(result_row->>'text_value', '')), '');
    result_notes := nullif(btrim(coalesce(result_row->>'notes', '')), '');

    if result_state = 'recorded' and result_numeric is null and result_text is null then
      delete from public.testing_results tr
      where tr.testing_day_test_id = result_test.id
        and tr.testing_day_participant_id = result_participant.id;
      if found then deleted_total := deleted_total + 1; end if;
      continue;
    end if;

    if result_state = 'recorded' and result_test.input_type = 'text' and result_text is null then
      raise exception 'A text result is required for %.', result_test.name;
    end if;
    if result_state = 'recorded' and result_test.input_type in ('number', 'time') and result_numeric is null then
      raise exception 'A numeric result is required for %.', result_test.name;
    end if;

    insert into public.testing_results (
      testing_day_test_id,
      testing_day_participant_id,
      result_status,
      numeric_value,
      text_value,
      notes,
      entered_by,
      recorded_at,
      updated_at
    ) values (
      result_test.id,
      result_participant.id,
      result_state,
      case when result_state = 'not_tested' or result_test.input_type = 'text' then null else result_numeric end,
      case when result_state = 'recorded' and result_test.input_type = 'text' then result_text else null end,
      result_notes,
      auth.uid(),
      now(),
      now()
    )
    on conflict (testing_day_test_id, testing_day_participant_id)
    do update set
      result_status = excluded.result_status,
      numeric_value = excluded.numeric_value,
      text_value = excluded.text_value,
      notes = excluded.notes,
      entered_by = auth.uid(),
      updated_at = now();

    update public.testing_day_participants tdp
    set participation_status = 'participated'
    where tdp.id = result_participant.id
      and tdp.participation_status <> 'did_not_participate';

    saved_total := saved_total + 1;
  end loop;

  return query select saved_total, deleted_total;
end;
$$;

create or replace function public.set_testing_participant_status(
  p_testing_day_participant_id uuid,
  p_status text
)
returns public.testing_day_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_participant public.testing_day_participants;
begin
  if p_status not in ('pending', 'participated', 'did_not_participate') then
    raise exception 'Unsupported participation status.';
  end if;

  update public.testing_day_participants tdp
  set participation_status = p_status
  from public.testing_days td
  where tdp.id = p_testing_day_participant_id
    and td.id = tdp.testing_day_id
    and td.status in ('scheduled', 'completed')
    and app_private.is_facility_coach(td.facility_id)
  returning tdp.* into saved_participant;

  if saved_participant.id is null then
    raise exception 'Testing Day participant is unavailable.';
  end if;

  if p_status = 'did_not_participate' then
    delete from public.testing_results tr
    where tr.testing_day_participant_id = saved_participant.id;
  end if;

  return saved_participant;
end;
$$;

create or replace function public.finish_testing_day(p_testing_day_id uuid)
returns public.testing_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_day public.testing_days;
  required_test_count integer;
begin
  select count(*)::integer into required_test_count
  from public.testing_day_tests tdt
  where tdt.testing_day_id = p_testing_day_id;

  if required_test_count = 0 then
    raise exception 'Add at least one test before finishing this Testing Day.';
  end if;

  if exists (
    select 1
    from public.testing_day_participants tdp
    where tdp.testing_day_id = p_testing_day_id
      and tdp.participation_status <> 'did_not_participate'
      and (
        select count(*)
        from public.testing_results tr
        join public.testing_day_tests tdt on tdt.id = tr.testing_day_test_id
        where tr.testing_day_participant_id = tdp.id
          and tdt.testing_day_id = p_testing_day_id
      ) <> required_test_count
  ) then
    raise exception 'Record a result, mark Not Tested, or mark the athlete absent for every outstanding test.';
  end if;

  update public.testing_days td
  set status = 'completed', updated_at = now()
  where td.id = p_testing_day_id
    and td.status = 'scheduled'
    and app_private.is_facility_coach(td.facility_id)
  returning td.* into saved_day;

  if saved_day.id is null then
    raise exception 'Only an available scheduled Testing Day can be finished.';
  end if;

  return saved_day;
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
  if p_status not in ('draft', 'scheduled', 'cancelled') then
    raise exception 'Unsupported Testing Day status. Use finish_testing_day to complete a day.';
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

revoke all on function public.save_testing_results(uuid, jsonb) from public;
revoke all on function public.set_testing_participant_status(uuid, text) from public;
revoke all on function public.finish_testing_day(uuid) from public;
revoke all on function public.set_testing_day_status(uuid, text) from public;
grant execute on function public.save_testing_results(uuid, jsonb) to authenticated;
grant execute on function public.set_testing_participant_status(uuid, text) to authenticated;
grant execute on function public.finish_testing_day(uuid) to authenticated;
grant execute on function public.set_testing_day_status(uuid, text) to authenticated;

comment on function public.finish_testing_day(uuid) is
  'Completes a scheduled Testing Day only after every participant and test has an explicit outcome.';

commit;
