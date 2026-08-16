-- =====================================================
-- PRODUCTION EXERCISE-TEMPLATE EXPORT
-- =====================================================
-- Read-only. Run only after confirming the Supabase dashboard URL contains
-- the Rip City production project reference: fdzmfohcuratbuitkwoy
--
-- This exports facility exercise configuration only. It does not return member
-- data, profile details, Auth users, secrets, or stored files.

select
  et.name,
  et.category,
  et.equipment,
  et.movement_pattern,
  et.input_type,
  et.description,
  et.video_url,
  et.coach_note,
  et.active,
  (et.created_by is not null) as has_creator,
  et.created_at
from public.exercise_templates et
join public.facilities f on f.id = et.facility_id
where f.slug = 'rip-city'
order by lower(et.name), et.created_at;
