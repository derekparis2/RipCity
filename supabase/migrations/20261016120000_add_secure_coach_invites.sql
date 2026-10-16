begin;

-- Coach onboarding uses a separate elevated path while preserving the current
-- reusable Athlete/H2K/general member signup links. Possessing a coach invite
-- creates only a pending membership; a facility admin must still approve it.

alter table public.facility_invites
  drop constraint if exists facility_invites_default_role_check;

alter table public.facility_invites
  add constraint facility_invites_default_role_check
  check (default_role in ('athlete', 'h2k_member', 'parent', 'coach'));

alter table public.facility_invites
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz;

alter table public.facility_invites
  drop constraint if exists facility_invites_claim_state_check;

alter table public.facility_invites
  add constraint facility_invites_claim_state_check
  check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  );

alter table public.facility_invites
  drop constraint if exists facility_invites_coach_shape_check;

alter table public.facility_invites
  add constraint facility_invites_coach_shape_check
  check (
    default_role <> 'coach'
    or (
      expires_at is not null
      and expires_at > created_at
      and expires_at <= created_at + interval '7 days'
      and default_member_type is null
      and default_group_id is null
    )
  );

create index if not exists facility_invites_active_code_idx
  on public.facility_invites (invite_code)
  where active = true;

-- A new user must never choose a global privilege through the public profile
-- insert. Facility access comes from an approved facility_members row.
drop policy if exists "profiles users can insert own profile" on public.profiles;

create policy "profiles users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and global_role = 'member'
);

-- Keep ordinary invite management compatible with the existing coach policy,
-- but reserve coach-invite visibility and mutation for facility admins.
drop policy if exists "facility_invites coaches can read facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can insert facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can update facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can delete facility invites" on public.facility_invites;

create policy "facility_invites authorized staff can read invites"
on public.facility_invites
for select
to authenticated
using (
  app_private.is_facility_admin(facility_id)
  or (
    default_role in ('athlete', 'h2k_member', 'parent')
    and app_private.is_facility_coach(facility_id)
  )
);

create policy "facility_invites authorized staff can insert invites"
on public.facility_invites
for insert
to authenticated
with check (
  created_by = auth.uid()
  and claimed_by is null
  and claimed_at is null
  and (
    (default_role = 'coach' and app_private.is_facility_admin(facility_id))
    or (
      default_role in ('athlete', 'h2k_member', 'parent')
      and app_private.is_facility_coach(facility_id)
    )
  )
);

create policy "facility_invites authorized staff can update invites"
on public.facility_invites
for update
to authenticated
using (
  app_private.is_facility_admin(facility_id)
  or (
    default_role in ('athlete', 'h2k_member', 'parent')
    and app_private.is_facility_coach(facility_id)
  )
)
with check (
  app_private.is_facility_admin(facility_id)
  or (
    default_role in ('athlete', 'h2k_member', 'parent')
    and app_private.is_facility_coach(facility_id)
  )
);

create policy "facility_invites authorized staff can delete invites"
on public.facility_invites
for delete
to authenticated
using (
  app_private.is_facility_admin(facility_id)
  or (
    default_role in ('athlete', 'h2k_member', 'parent')
    and app_private.is_facility_coach(facility_id)
  )
);

-- This intentionally reveals only the facility label and expiration for a
-- valid unclaimed coach code. It does not expose invite rows or user data.
create or replace function public.lookup_coach_invite(lookup_invite_code text)
returns table (
  facility_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.name, fi.expires_at
  from public.facility_invites fi
  join public.facilities f on f.id = fi.facility_id
  where fi.invite_code = lookup_invite_code
    and fi.default_role = 'coach'
    and fi.active = true
    and fi.claimed_by is null
    and fi.claimed_at is null
    and fi.expires_at is not null
    and fi.expires_at > now()
  limit 1;
$$;

revoke all on function public.lookup_coach_invite(text) from public;
grant execute on function public.lookup_coach_invite(text) to anon, authenticated;

-- Claiming is atomic: the invite row is locked, the pending coach membership
-- is inserted, and the invite is consumed in the same transaction.
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
     or invite_row.claimed_by is not null
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

revoke all on function public.claim_coach_invite(text) from public;
grant execute on function public.claim_coach_invite(text) to authenticated;

commit;
