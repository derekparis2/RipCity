-- =====================================================
-- H2K BAND COLOR V1
-- =====================================================
-- Proposed migration only. Do not run from Codex.
--
-- Purpose:
-- - Add a coach-managed H2K band color to member_profiles.
-- - H2K band color works like a karate belt/rank for training level.
-- - Members can read their own band color, but only approved facility
--   coaches/admins should be able to change it.

alter table public.member_profiles
  add column if not exists h2k_band_color text;

alter table public.member_profiles
  drop constraint if exists member_profiles_h2k_band_color_check;

alter table public.member_profiles
  add constraint member_profiles_h2k_band_color_check
  check (
    h2k_band_color is null
    or h2k_band_color in (
      'White',
      'Grey',
      'Green',
      'Blue',
      'Black',
      'Red'
    )
  );

-- Prevent members from changing their own H2K band color through the existing
-- "users can update own profile" policy. Coaches/admins in the member's
-- facility are allowed to change it from the roster.
create or replace function app_private.prevent_member_h2k_band_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_facility_id uuid;
begin
  if tg_op = 'INSERT' and new.h2k_band_color is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.h2k_band_color is not distinct from old.h2k_band_color then
    return new;
  end if;

  select fm.facility_id
  into profile_facility_id
  from public.facility_members fm
  where fm.id = new.facility_member_id;

  if app_private.is_facility_coach(profile_facility_id) then
    return new;
  end if;

  raise exception 'Only facility coaches can update H2K band color.';
end;
$$;

drop trigger if exists prevent_member_h2k_band_self_update
on public.member_profiles;

create trigger prevent_member_h2k_band_self_update
before insert or update of h2k_band_color
on public.member_profiles
for each row
execute function app_private.prevent_member_h2k_band_self_update();
