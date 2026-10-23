-- Expose only coach display names for workout assignments the caller may
-- already view. Members must not need broad profile-table access just to see
-- who created or assigned their workout.

create or replace function public.get_workout_attributions(check_assignment_ids uuid[])
returns table (
  assignment_id uuid,
  workout_creator_name text,
  assignment_assigner_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    wa.id,
    coalesce(creator.full_name, 'Coach') as workout_creator_name,
    coalesce(assigner.full_name, 'Coach') as assignment_assigner_name
  from public.workout_assignments wa
  join public.workouts w on w.id = wa.workout_id
  left join public.profiles creator on creator.id = w.created_by
  left join public.profiles assigner on assigner.id = wa.assigned_by
  where wa.id = any(coalesce(check_assignment_ids, array[]::uuid[]))
    and app_private.can_view_workout_assignment(wa.id);
$$;

revoke all on function public.get_workout_attributions(uuid[]) from public;
grant execute on function public.get_workout_attributions(uuid[]) to authenticated;
