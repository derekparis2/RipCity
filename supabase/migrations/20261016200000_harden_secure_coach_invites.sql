begin;

-- A consumed invite stays consumed even if the claiming profile is later
-- removed. `claimed_at` is the durable consumption marker; `claimed_by` may be
-- cleared by its ON DELETE SET NULL foreign key.
alter table public.facility_invites
  drop constraint if exists facility_invites_claim_state_check;

alter table public.facility_invites
  add constraint facility_invites_claim_state_check
  check (
    (claimed_at is null and claimed_by is null)
    or (claimed_at is not null and active = false)
  );

create or replace function app_private.prevent_coach_invite_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.default_role = 'coach'
     and old.claimed_at is not null
     and (
       new.claimed_at is distinct from old.claimed_at
       or new.active = true
     ) then
    raise exception 'A claimed coach invite cannot be reopened.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_coach_invite_reopen
  on public.facility_invites;

create trigger prevent_coach_invite_reopen
before update on public.facility_invites
for each row
execute function app_private.prevent_coach_invite_reopen();

-- Generate the secret and both timestamps on the database server. Using one
-- captured timestamp keeps the seven-day constraint exact and independent of
-- the coach's device clock or network latency.
create or replace function public.create_coach_invite(invite_facility_id uuid)
returns table (
  invite_id uuid,
  invite_code text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  server_now timestamptz := statement_timestamp();
  generated_code text := 'coach-' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a coach invite.';
  end if;

  if not app_private.is_facility_admin(invite_facility_id) then
    raise exception 'Only a facility administrator can create coach invites.';
  end if;

  return query
  insert into public.facility_invites (
    facility_id,
    created_by,
    invite_code,
    default_role,
    default_member_type,
    default_group_id,
    active,
    expires_at,
    created_at
  )
  values (
    invite_facility_id,
    auth.uid(),
    generated_code,
    'coach',
    null,
    null,
    true,
    server_now + interval '7 days',
    server_now
  )
  returning
    facility_invites.id,
    facility_invites.invite_code,
    facility_invites.created_at,
    facility_invites.expires_at;
end;
$$;

revoke all on function public.create_coach_invite(uuid) from public;
grant execute on function public.create_coach_invite(uuid) to authenticated;

-- An account left without the invited membership after an interrupted claim
-- may retry with a fresh link. Existing membership in the invited facility is
-- still rejected; the database retains the established cross-facility coach
-- capability even though facility switching is not exposed in the V2 UI.
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
