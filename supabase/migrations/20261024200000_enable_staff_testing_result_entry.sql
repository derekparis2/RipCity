-- Coaches and facility admins may record official Testing Day results through
-- one transactional RPC. Members remain read-only and direct table writes stay
-- disabled so athlete-first and test-first screens share one canonical result.

begin;

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

    result_numeric := nullif(result_row->>'numeric_value', '')::numeric;
    result_text := nullif(btrim(coalesce(result_row->>'text_value', '')), '');
    result_notes := nullif(btrim(coalesce(result_row->>'notes', '')), '');

    if result_numeric is null and result_text is null then
      delete from public.testing_results tr
      where tr.testing_day_test_id = result_test.id
        and tr.testing_day_participant_id = result_participant.id;
      if found then deleted_total := deleted_total + 1; end if;
      continue;
    end if;

    if result_test.input_type = 'text' and result_text is null then
      raise exception 'A text result is required for %.', result_test.name;
    end if;
    if result_test.input_type in ('number', 'time') and result_numeric is null then
      raise exception 'A numeric result is required for %.', result_test.name;
    end if;

    insert into public.testing_results (
      testing_day_test_id,
      testing_day_participant_id,
      numeric_value,
      text_value,
      notes,
      entered_by,
      recorded_at,
      updated_at
    ) values (
      result_test.id,
      result_participant.id,
      case when result_test.input_type = 'text' then null else result_numeric end,
      case when result_test.input_type = 'text' then result_text else null end,
      result_notes,
      auth.uid(),
      now(),
      now()
    )
    on conflict (testing_day_test_id, testing_day_participant_id)
    do update set
      numeric_value = excluded.numeric_value,
      text_value = excluded.text_value,
      notes = excluded.notes,
      entered_by = auth.uid(),
      updated_at = now();

    saved_total := saved_total + 1;
  end loop;

  return query select saved_total, deleted_total;
end;
$$;

revoke all on function public.save_testing_results(uuid, jsonb) from public;
grant execute on function public.save_testing_results(uuid, jsonb) to authenticated;

comment on function public.save_testing_results(uuid, jsonb) is
  'Transactionally upserts or clears official Testing Day results for approved same-facility coaches and admins.';

commit;
