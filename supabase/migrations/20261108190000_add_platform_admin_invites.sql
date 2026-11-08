begin;

-- A platform owner can invite the first real administrator for a newly
-- provisioned facility. The link is single-use, expires after seven days, and
-- creates only a pending membership so the established approval rule remains
-- intact.
alter table public.facility_invites
  drop constraint if exists facility_invites_default_role_check;

alter table public.facility_invites
  add constraint facility_invites_default_role_check
  check (default_role in ('athlete', 'h2k_member', 'parent', 'coach', 'admin'));

alter table public.facility_invites
  drop constraint if exists facility_invites_coach_shape_check;

alter table public.facility_invites
  add constraint facility_invites_coach_shape_check
  check (
    default_role not in ('coach', 'admin')
    or (
      expires_at is not null
      and expires_at > created_at
      and expires_at <= created_at + interval '7 days'
      and default_member_type is null
      and default_group_id is null
    )
  );

create or replace function public.create_platform_admin_invite(p_facility_id uuid)
returns table (
  invite_id uuid,
  invite_code text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  server_now timestamptz := statement_timestamp();
  generated_code text := 'admin-' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.facilities f
    where f.id = p_facility_id and f.status = 'active'
  ) then
    raise exception 'An active facility is required.' using errcode = '22023';
  end if;

  return query
  insert into public.facility_invites (
    facility_id, created_by, invite_code, default_role,
    default_member_type, default_group_id, active, expires_at, created_at
  ) values (
    p_facility_id, auth.uid(), generated_code, 'admin',
    null, null, true, server_now + interval '7 days', server_now
  )
  returning facility_invites.id, facility_invites.invite_code,
    facility_invites.created_at, facility_invites.expires_at;
end;
$$;

revoke all on function public.create_platform_admin_invite(uuid) from public;
grant execute on function public.create_platform_admin_invite(uuid) to authenticated;

create or replace function public.lookup_platform_admin_invite_configuration(lookup_invite_code text)
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
    and fi.default_role = 'admin'
    and fi.active = true
    and fi.claimed_at is null
    and fi.expires_at > now()
    and f.status = 'active'
  limit 1;
$$;

revoke all on function public.lookup_platform_admin_invite_configuration(text) from public;
grant execute on function public.lookup_platform_admin_invite_configuration(text) to anon, authenticated;

create or replace function public.claim_platform_admin_invite(claim_invite_code text)
returns table (membership_id uuid, facility_id uuid, facility_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_row public.facility_invites%rowtype;
  created_membership_id uuid;
  target_facility_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to claim an administrator invite.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'Create your profile before claiming the administrator invite.';
  end if;

  select * into invite_row
  from public.facility_invites fi
  where fi.invite_code = claim_invite_code and fi.default_role = 'admin'
  for update;

  if invite_row.id is null then
    raise exception 'Administrator invite not found.';
  end if;
  if not invite_row.active or invite_row.claimed_at is not null then
    raise exception 'This administrator invite has already been used.';
  end if;
  if invite_row.expires_at is null or invite_row.expires_at <= now() then
    raise exception 'This administrator invite has expired.';
  end if;
  if exists (
    select 1 from public.facility_members fm
    where fm.facility_id = invite_row.facility_id and fm.profile_id = auth.uid()
  ) then
    raise exception 'This account already belongs to that facility.';
  end if;

  insert into public.facility_members (facility_id, profile_id, role, status)
  values (invite_row.facility_id, auth.uid(), 'admin', 'pending')
  returning id into created_membership_id;

  update public.facility_invites
  set active = false, claimed_by = auth.uid(), claimed_at = now()
  where id = invite_row.id;

  select f.name into target_facility_name
  from public.facilities f where f.id = invite_row.facility_id;

  return query
  select created_membership_id, invite_row.facility_id, target_facility_name;
end;
$$;

revoke all on function public.claim_platform_admin_invite(text) from public;
grant execute on function public.claim_platform_admin_invite(text) to authenticated;

commit;
