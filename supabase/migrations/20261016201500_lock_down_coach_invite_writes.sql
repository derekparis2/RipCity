begin;

-- Once any invite has a claim timestamp, it is permanently consumed. Do not
-- key this protection to the current role because changing the role first must
-- not create a two-update path for reopening the invite.
create or replace function app_private.prevent_coach_invite_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.claimed_at is not null
     and (
       new.claimed_at is distinct from old.claimed_at
       or new.active = true
       or new.default_role is distinct from old.default_role
       or new.invite_code is distinct from old.invite_code
       or new.facility_id is distinct from old.facility_id
       or new.created_at is distinct from old.created_at
       or new.expires_at is distinct from old.expires_at
     ) then
    raise exception 'A claimed invite cannot be reopened or repurposed.';
  end if;

  return new;
end;
$$;

-- Coach invitation secrets, creation times, and expiration times are created
-- only by public.create_coach_invite(). The SECURITY DEFINER RPC performs its
-- own facility-admin check and bypasses these direct-table client policies.
drop policy if exists "facility_invites authorized staff can insert invites"
  on public.facility_invites;

create policy "facility_invites authorized staff can insert invites"
on public.facility_invites
for insert
to authenticated
with check (
  created_by = auth.uid()
  and claimed_by is null
  and claimed_at is null
  and default_role in ('athlete', 'h2k_member', 'parent')
  and app_private.is_facility_coach(facility_id)
);

drop policy if exists "facility_invites authorized staff can update invites"
  on public.facility_invites;

create policy "facility_invites authorized staff can update invites"
on public.facility_invites
for update
to authenticated
using (
  default_role in ('athlete', 'h2k_member', 'parent')
  and app_private.is_facility_coach(facility_id)
)
with check (
  default_role in ('athlete', 'h2k_member', 'parent')
  and app_private.is_facility_coach(facility_id)
);

commit;
