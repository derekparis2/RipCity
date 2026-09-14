-- Apply the Rip City coach-approved starter catalog corrections.
-- Existing workout_exercises are historical snapshots and are intentionally
-- unchanged; these defaults apply when coaches add exercises going forward.

begin;

do $$
declare
  rip_city_count integer;
  med_ball_count integer;
begin
  select count(*) into rip_city_count
  from public.facilities
  where slug = 'rip-city';

  if rip_city_count <> 1 then
    raise exception
      'Expected exactly one Rip City facility, found %.',
      rip_city_count;
  end if;

  select count(*) into med_ball_count
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) in (
      'med ball chest pass',
      'med ball shot put',
      'med ball slam'
    );

  if med_ball_count <> 3 then
    raise exception
      'Expected all three Rip City medicine-ball starter exercises, found %.',
      med_ball_count;
  end if;
end
$$;

update public.exercise_templates et
set
  input_type = 'weight_reps',
  is_unilateral = case
    when lower(et.name) = 'med ball shot put' then true
    else et.is_unilateral
  end,
  updated_at = now()
from public.facilities f
where f.id = et.facility_id
  and f.slug = 'rip-city'
  and lower(et.name) in (
    'med ball chest pass',
    'med ball shot put',
    'med ball slam'
  );

insert into public.exercise_templates (
  facility_id,
  name,
  category,
  equipment,
  movement_pattern,
  input_type,
  description,
  is_unilateral
)
select
  f.id,
  'Vertical Jump',
  'Power',
  'Bodyweight',
  'Jump',
  'distance',
  'Jump vertically with full intent, record the measured height, and land with control.',
  false
from public.facilities f
where f.slug = 'rip-city'
on conflict do nothing;

-- Correct an existing same-name facility row as well as a newly inserted row.
update public.exercise_templates et
set
  input_type = 'distance',
  updated_at = now()
from public.facilities f
where f.id = et.facility_id
  and f.slug = 'rip-city'
  and lower(et.name) = 'vertical jump';

do $$
begin
  if (
    select count(*)
    from public.exercise_templates et
    join public.facilities f on f.id = et.facility_id
    where f.slug = 'rip-city'
      and lower(et.name) in (
        'med ball chest pass',
        'med ball shot put',
        'med ball slam'
      )
      and et.input_type = 'weight_reps'
  ) <> 3 then
    raise exception 'Medicine-ball exercise correction verification failed.';
  end if;

  if not exists (
    select 1
    from public.exercise_templates et
    join public.facilities f on f.id = et.facility_id
    where f.slug = 'rip-city'
      and lower(et.name) = 'vertical jump'
      and et.input_type = 'distance'
  ) then
    raise exception 'Vertical Jump exercise verification failed.';
  end if;
end
$$;

commit;
