-- Reject coach/admin invite claims once a facility is archived.
begin;

create or replace function public.claim_coach_invite(claim_invite_code text)
returns table (
  membership_id uuid,
  facility_id uuid,
  facility_name text
)
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
    raise exception 'You must be signed in to claim a coach invite.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'Create your profile before claiming the coach invite.';
  end if;

  select *
  into invite_row
  from public.facility_invites fi
  where fi.invite_code = claim_invite_code
    and fi.default_role = 'coach'
  for update;

  if invite_row.id is null then
    raise exception 'Coach invite not found.';
  end if;

  if not invite_row.active
     or invite_row.claimed_at is not null then
    raise exception 'This coach invite has already been used.';
  end if;

  if invite_row.expires_at is null or invite_row.expires_at <= now() then
    raise exception 'This coach invite has expired.';
  end if;

  if exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = invite_row.facility_id
      and fm.profile_id = auth.uid()
  ) then
    raise exception 'This account already belongs to that facility.';
  end if;

  -- Lock the facility while claiming, so archival cannot race this check.
  perform 1 from public.facilities facility
  where facility.id = invite_row.facility_id and facility.status = 'active'
  for share;
  if not found then
    raise exception 'This facility is not currently active.' using errcode = '42501';
  end if;

  insert into public.facility_members (
    facility_id,
    profile_id,
    role,
    status
  )
  values (
    invite_row.facility_id,
    auth.uid(),
    'coach',
    'pending'
  )
  returning id into created_membership_id;

  update public.facility_invites
  set
    active = false,
    claimed_by = auth.uid(),
    claimed_at = now()
  where id = invite_row.id;

  select f.name
  into target_facility_name
  from public.facilities f
  where f.id = invite_row.facility_id;

  return query
  select created_membership_id, invite_row.facility_id, target_facility_name;
end;
$$;

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

  -- Lock the facility while claiming, so archival cannot race this check.
  perform 1 from public.facilities facility
  where facility.id = invite_row.facility_id and facility.status = 'active'
  for share;
  if not found then
    raise exception 'This facility is not currently active.' using errcode = '42501';
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

commit;
