begin;

-- Public signup needs a deliberately small, read-only facility description.
-- This avoids granting anonymous users access to configuration tables while
-- allowing one shared signup page to represent any active facility.
create or replace function public.lookup_signup_facility(p_facility_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'facility_id', f.id,
    'facility_name', f.name,
    'facility_slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'time_zone', f.time_zone,
    'programs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'program_key', fp.program_key,
          'display_name', fp.display_name,
          'plural_name', fp.plural_name,
          'enabled', fp.enabled,
          'sort_order', fp.sort_order
        )
        order by fp.sort_order, fp.program_key
      )
      from public.facility_programs fp
      where fp.facility_id = f.id
        and fp.enabled = true
    ), '[]'::jsonb)
  )
  from public.facilities f
  where f.slug = lower(btrim(coalesce(p_facility_slug, '')))
    and f.status = 'active'
  limit 1;
$$;

revoke all on function public.lookup_signup_facility(text) from public;
grant execute on function public.lookup_signup_facility(text) to anon, authenticated;

-- Coach invite signup receives the same public branding without exposing the
-- invite row or facility configuration tables.
create or replace function public.lookup_coach_invite_configuration(lookup_invite_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'facility_name', f.name,
    'facility_slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'expires_at', fi.expires_at
  )
  from public.facility_invites fi
  join public.facilities f on f.id = fi.facility_id
  where fi.invite_code = lookup_invite_code
    and fi.default_role = 'coach'
    and fi.active = true
    and fi.claimed_by is null
    and fi.claimed_at is null
    and fi.expires_at is not null
    and fi.expires_at > now()
    and f.status = 'active'
  limit 1;
$$;

revoke all on function public.lookup_coach_invite_configuration(text) from public;
grant execute on function public.lookup_coach_invite_configuration(text) to anon, authenticated;

-- Replace the Rip City-only signup RPC with a facility-aware signature. The
-- default preserves old links and callers while new links pass their slug.
drop function if exists public.complete_member_signup(
  text, text, text, text, text, text, integer, numeric
);
drop function if exists public.complete_member_signup(
  text, text, text, text, text, text, integer, numeric, text
);

create function public.complete_member_signup(
  p_full_name text,
  p_username text,
  p_member_type text,
  p_sport text,
  p_position text,
  p_school text,
  p_graduation_year integer,
  p_body_weight numeric,
  p_facility_slug text default 'rip-city'
)
returns table (
  facility_member_id uuid,
  member_profile_id uuid,
  membership_status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  requester_id uuid := auth.uid();
  requester_email text;
  normalized_name text := btrim(coalesce(p_full_name, ''));
  normalized_username text := lower(btrim(trim(leading '@' from coalesce(p_username, ''))));
  normalized_facility_slug text := lower(btrim(coalesce(p_facility_slug, '')));
  target_facility_id uuid;
  expected_role text;
  existing_profile public.profiles%rowtype;
  target_membership public.facility_members%rowtype;
  target_member_profile public.member_profiles%rowtype;
begin
  if requester_id is null then
    raise exception 'Authentication is required to complete signup.';
  end if;

  select lower(u.email)
  into requester_email
  from auth.users u
  where u.id = requester_id;

  if requester_email is null or requester_email = '' then
    raise exception 'The authenticated account does not have an email address.';
  end if;

  if normalized_name = '' then
    raise exception 'Full name is required.';
  end if;

  if normalized_username = '' or normalized_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Username may use letters, numbers, periods, underscores, and hyphens.';
  end if;

  if p_member_type is null or p_member_type not in ('athlete', 'h2k') then
    raise exception 'Choose a valid member program.';
  end if;

  if p_graduation_year is not null and (p_graduation_year < 2000 or p_graduation_year > 2100) then
    raise exception 'Graduation year is outside the supported range.';
  end if;

  if p_body_weight is not null and p_body_weight <= 0 then
    raise exception 'Body weight must be greater than zero.';
  end if;

  select f.id
  into target_facility_id
  from public.facilities f
  where f.slug = normalized_facility_slug
    and f.status = 'active'
  limit 1;

  if target_facility_id is null then
    raise exception 'This facility signup link is invalid or no longer active.';
  end if;

  if not exists (
    select 1
    from public.facility_programs fp
    where fp.facility_id = target_facility_id
      and fp.program_key = p_member_type
      and fp.enabled = true
  ) then
    raise exception 'This member program is not enabled for the facility.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = normalized_username
      and p.id <> requester_id
  ) then
    raise exception 'That username is already taken.';
  end if;

  select p.*
  into existing_profile
  from public.profiles p
  where p.id = requester_id;

  if existing_profile.id is null then
    insert into public.profiles (id, email, full_name, username, global_role)
    values (requester_id, requester_email, normalized_name, normalized_username, 'member');
  elsif lower(existing_profile.email) <> requester_email
     or lower(btrim(coalesce(existing_profile.username, ''))) <> normalized_username then
    raise exception 'Use the email and username already saved for this account.';
  end if;

  if exists (
    select 1
    from public.facility_members fm
    where fm.profile_id = requester_id
      and fm.facility_id <> target_facility_id
  ) then
    raise exception 'This account already belongs to another facility.';
  end if;

  expected_role := case when p_member_type = 'athlete' then 'athlete' else 'h2k_member' end;

  insert into public.facility_members (facility_id, profile_id, role, status)
  values (target_facility_id, requester_id, expected_role, 'pending')
  on conflict (facility_id, profile_id) do nothing;

  select fm.*
  into target_membership
  from public.facility_members fm
  where fm.facility_id = target_facility_id
    and fm.profile_id = requester_id;

  if target_membership.id is null then
    raise exception 'The facility membership could not be created.';
  end if;

  if target_membership.role <> expected_role then
    raise exception 'Use the member program already saved for this account.';
  end if;

  insert into public.member_profiles (
    facility_member_id,
    member_type,
    sport,
    age_group,
    position,
    school,
    graduation_year,
    body_weight
  )
  values (
    target_membership.id,
    p_member_type,
    case when p_member_type = 'athlete' then nullif(btrim(coalesce(p_sport, '')), '') end,
    null,
    case when p_member_type = 'athlete' then nullif(btrim(coalesce(p_position, '')), '') end,
    case when p_member_type = 'athlete' then nullif(btrim(coalesce(p_school, '')), '') end,
    p_graduation_year,
    p_body_weight
  )
  on conflict do nothing;

  select mp.*
  into target_member_profile
  from public.member_profiles mp
  where mp.facility_member_id = target_membership.id;

  if target_member_profile.id is null then
    raise exception 'The member profile could not be created.';
  end if;

  if target_member_profile.member_type <> p_member_type then
    raise exception 'Use the member program already saved for this account.';
  end if;

  return query
  select target_membership.id, target_member_profile.id, target_membership.status;
end;
$$;

revoke all on function public.complete_member_signup(
  text, text, text, text, text, text, integer, numeric, text
) from public;

grant execute on function public.complete_member_signup(
  text, text, text, text, text, text, integer, numeric, text
) to authenticated;

comment on function public.complete_member_signup(
  text, text, text, text, text, text, integer, numeric, text
) is 'Atomically creates or resumes an authenticated member signup in the active facility identified by slug.';

commit;
