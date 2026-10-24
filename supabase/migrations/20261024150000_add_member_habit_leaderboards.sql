-- Members can view a privacy-safe leaderboard for their own program only.
-- The function returns competition-ranked top-five positions plus the caller's
-- own row. It never exposes the full facility list or the other member type.

create or replace function public.get_member_habit_leaderboard(
  metric_key text,
  scope_group_id uuid default null,
  as_of_date date default current_date
)
returns table (
  member_profile_id uuid,
  full_name text,
  profile_picture_url text,
  group_names text,
  rank bigint,
  score numeric,
  score_max numeric,
  detail_count integer,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  requester_facility_id uuid;
  requester_member_profile_id uuid;
  requester_member_type text;
  current_week_start date;
  completed_weeks_start date;
  active_habit_count integer;
begin
  if metric_key not in (
    'fourWeekAverage',
    'currentWeekScore',
    'currentStreak',
    'longestStreak'
  ) then
    raise exception 'Unsupported member leaderboard metric.';
  end if;

  select fm.facility_id, mp.id, mp.member_type
    into requester_facility_id, requester_member_profile_id, requester_member_type
  from public.facility_members fm
  join public.member_profiles mp on mp.facility_member_id = fm.id
  where fm.profile_id = auth.uid()
    and fm.status = 'approved'
    and (
      (fm.role = 'athlete' and mp.member_type = 'athlete')
      or (fm.role = 'h2k_member' and mp.member_type = 'h2k')
    )
  limit 1;

  if requester_member_profile_id is null then
    raise exception 'An approved athlete or H2K membership is required.';
  end if;

  if scope_group_id is not null and not exists (
    select 1
    from public.group_members own_group
    join public.groups g on g.id = own_group.group_id
    where own_group.member_profile_id = requester_member_profile_id
      and own_group.group_id = scope_group_id
      and g.facility_id = requester_facility_id
      and g.member_type in (requester_member_type, 'both')
  ) then
    raise exception 'Members may only view leaderboards for their own groups.';
  end if;

  current_week_start := as_of_date - (extract(isodow from as_of_date)::integer - 1);
  completed_weeks_start := current_week_start - 28;

  select count(*)::integer
    into active_habit_count
  from public.habits h
  where h.facility_id = requester_facility_id
    and h.active = true;

  active_habit_count := greatest(active_habit_count, 1);

  return query
  with eligible_members as (
    select
      mp.id,
      p.full_name,
      p.profile_picture_url,
      coalesce(string_agg(distinct g.name, ', ' order by g.name), 'No group') as group_names
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    join public.profiles p on p.id = fm.profile_id
    left join public.group_members gm on gm.member_profile_id = mp.id
    left join public.groups g
      on g.id = gm.group_id
      and g.facility_id = requester_facility_id
    where fm.facility_id = requester_facility_id
      and fm.status = 'approved'
      and mp.member_type = requester_member_type
      and (
        (requester_member_type = 'athlete' and fm.role = 'athlete')
        or (requester_member_type = 'h2k' and fm.role = 'h2k_member')
      )
      and (
        scope_group_id is null
        or exists (
          select 1
          from public.group_members scoped_membership
          where scoped_membership.member_profile_id = mp.id
            and scoped_membership.group_id = scope_group_id
        )
      )
    group by mp.id, p.full_name, p.profile_picture_url
  ),
  day_scores as (
    select
      hl.member_profile_id,
      hl.log_date,
      count(distinct hl.habit_id)::integer as completed_habits,
      sum(hl.points_earned)::numeric as points
    from public.habit_logs hl
    join eligible_members em on em.id = hl.member_profile_id
    join public.habits h
      on h.id = hl.habit_id
      and h.facility_id = requester_facility_id
      and h.active = true
    where hl.completed = true
      and hl.log_date <= as_of_date
    group by hl.member_profile_id, hl.log_date
  ),
  qualified_days as (
    select
      ds.member_profile_id,
      ds.log_date,
      ds.log_date - (
        row_number() over (
          partition by ds.member_profile_id
          order by ds.log_date
        )::integer
      ) as streak_island
    from day_scores ds
    where ds.completed_habits >= 4
  ),
  streaks as (
    select
      qd.member_profile_id,
      min(qd.log_date) as start_date,
      max(qd.log_date) as end_date,
      count(*)::integer as day_count
    from qualified_days qd
    group by qd.member_profile_id, qd.streak_island
  ),
  member_metrics as (
    select
      em.id,
      em.full_name,
      em.profile_picture_url,
      em.group_names,
      case
        when coalesce(sum(ds.points) filter (
          where ds.log_date between completed_weeks_start and current_week_start - 1
        ), 0) > 0
          then round((sum(ds.points) filter (
            where ds.log_date between completed_weeks_start and current_week_start - 1
          )) / 4.0, 1)
        else null
      end as four_week_average,
      case
        when count(ds.log_date) filter (
          where ds.log_date between current_week_start and as_of_date
        ) > 0
          then coalesce(sum(ds.points) filter (
            where ds.log_date between current_week_start and as_of_date
          ), 0)
        else null
      end as current_week_score,
      count(ds.log_date) filter (
        where ds.log_date between current_week_start and as_of_date
          and ds.completed_habits >= 4
      )::integer as current_week_qualified_days,
      case
        when count(ds.log_date) > 0 then coalesce((
          select max(s.day_count)
          from streaks s
          where s.member_profile_id = em.id
            and s.end_date = case
              when exists (
                select 1
                from qualified_days today
                where today.member_profile_id = em.id
                  and today.log_date = as_of_date
              ) then as_of_date
              else as_of_date - 1
            end
        ), 0)
        else null
      end as current_streak,
      case
        when count(ds.log_date) > 0 then coalesce((
          select max(s.day_count)
          from streaks s
          where s.member_profile_id = em.id
        ), 0)
        else null
      end as longest_streak
    from eligible_members em
    left join day_scores ds on ds.member_profile_id = em.id
    group by em.id, em.full_name, em.profile_picture_url, em.group_names
  ),
  selected_scores as (
    select
      mm.*,
      case metric_key
        when 'fourWeekAverage' then mm.four_week_average
        when 'currentWeekScore' then mm.current_week_score
        when 'currentStreak' then mm.current_streak
        when 'longestStreak' then mm.longest_streak
      end::numeric as selected_score,
      case metric_key
        when 'fourWeekAverage' then (active_habit_count * 7)::numeric
        when 'currentWeekScore' then (active_habit_count * 7)::numeric
        else null
      end as selected_score_max,
      case metric_key
        when 'currentWeekScore' then mm.current_week_qualified_days
        else null
      end as selected_detail_count
    from member_metrics mm
  ),
  ranked as (
    select
      ss.*,
      case
        when ss.selected_score is null then null
        else rank() over (order by ss.selected_score desc nulls last)
      end as selected_rank
    from selected_scores ss
  )
  select
    r.id,
    r.full_name,
    r.profile_picture_url,
    r.group_names,
    r.selected_rank,
    r.selected_score,
    r.selected_score_max,
    r.selected_detail_count,
    r.id = requester_member_profile_id
  from ranked r
  where (r.selected_rank is not null and r.selected_rank <= 5)
     or r.id = requester_member_profile_id
  order by r.selected_rank asc nulls last, r.full_name asc;
end;
$$;

revoke all on function public.get_member_habit_leaderboard(text, uuid, date) from public;
grant execute on function public.get_member_habit_leaderboard(text, uuid, date) to authenticated;

comment on function public.get_member_habit_leaderboard(text, uuid, date) is
  'Returns only the caller program top-five habit ranks plus the caller own rank, optionally scoped to one of the caller groups.';
