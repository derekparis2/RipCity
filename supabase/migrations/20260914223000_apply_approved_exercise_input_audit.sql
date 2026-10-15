-- Apply the remaining Rip City coach-approved starter exercise defaults.
-- Existing workout_exercises remain historical snapshots and are unchanged.

begin;

do $$
declare
  prescribed_distance_count integer;
  each_side_count integer;
begin
  select count(*) into prescribed_distance_count
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) = any (array[
      'lateral shuffle',
      'carioca',
      'a-skip',
      'high knees',
      'backpedal',
      'farmer carry',
      'suitcase carry',
      'bear crawl',
      'sled push',
      'sled pull'
    ]);

  if prescribed_distance_count <> 10 then
    raise exception
      'Expected 10 prescribed-distance starter exercises, found %.',
      prescribed_distance_count;
  end if;

  select count(*) into each_side_count
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) = any (array[
      'single-leg rdl',
      'split squat',
      'rear-foot elevated split squat',
      'lateral lunge',
      'reverse lunge',
      'step-up',
      'half-kneeling db press',
      'med ball shot put',
      'single-arm db row',
      'skater jump',
      'lateral bound',
      'pallof press',
      'side plank',
      'suitcase carry',
      'bird dog',
      'thoracic open book',
      'band external rotation',
      'band internal rotation',
      'wrist pronation/supination',
      'wrist flexion/extension'
    ]);

  if each_side_count <> 20 then
    raise exception
      'Expected 20 Each Side starter exercises, found %.',
      each_side_count;
  end if;
end
$$;

update public.exercise_templates et
set
  input_type = 'completion',
  updated_at = now()
from public.facilities f
where f.id = et.facility_id
  and f.slug = 'rip-city'
  and lower(et.name) = any (array[
    'lateral shuffle',
    'carioca',
    'a-skip',
    'high knees',
    'backpedal',
    'farmer carry',
    'suitcase carry',
    'bear crawl',
    'sled push',
    'sled pull'
  ]);

update public.exercise_templates et
set
  is_unilateral = true,
  updated_at = now()
from public.facilities f
where f.id = et.facility_id
  and f.slug = 'rip-city'
  and lower(et.name) = any (array[
    'single-leg rdl',
    'split squat',
    'rear-foot elevated split squat',
    'lateral lunge',
    'reverse lunge',
    'step-up',
    'half-kneeling db press',
    'med ball shot put',
    'single-arm db row',
    'skater jump',
    'lateral bound',
    'pallof press',
    'side plank',
    'suitcase carry',
    'bird dog',
    'thoracic open book',
    'band external rotation',
    'band internal rotation',
    'wrist pronation/supination',
    'wrist flexion/extension'
  ]);

do $$
begin
  if (
    select count(*)
    from public.exercise_templates et
    join public.facilities f on f.id = et.facility_id
    where f.slug = 'rip-city'
      and et.input_type = 'completion'
      and lower(et.name) = any (array[
        'lateral shuffle', 'carioca', 'a-skip', 'high knees', 'backpedal',
        'farmer carry', 'suitcase carry', 'bear crawl', 'sled push', 'sled pull'
      ])
  ) <> 10 then
    raise exception 'Prescribed-distance correction verification failed.';
  end if;

  if (
    select count(*)
    from public.exercise_templates et
    join public.facilities f on f.id = et.facility_id
    where f.slug = 'rip-city'
      and et.is_unilateral
      and lower(et.name) = any (array[
        'single-leg rdl', 'split squat', 'rear-foot elevated split squat',
        'lateral lunge', 'reverse lunge', 'step-up', 'half-kneeling db press',
        'med ball shot put', 'single-arm db row', 'skater jump', 'lateral bound',
        'pallof press', 'side plank', 'suitcase carry', 'bird dog',
        'thoracic open book', 'band external rotation', 'band internal rotation',
        'wrist pronation/supination', 'wrist flexion/extension'
      ])
  ) <> 20 then
    raise exception 'Each Side default verification failed.';
  end if;
end
$$;

commit;
