begin;

-- Platform ownership is intentionally separate from profiles.global_role and
-- facility_members.role. A platform owner may provision and configure
-- facilities through trusted operations, but does not automatically become a
-- member of every facility or bypass facility-scoped RLS.
create table if not exists app_private.platform_owners (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  facility_id uuid references public.facilities(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_actor_created_idx
  on app_private.platform_audit_events (actor_profile_id, created_at desc);

create index if not exists platform_audit_events_facility_created_idx
  on app_private.platform_audit_events (facility_id, created_at desc);

revoke all on table app_private.platform_owners from public, anon, authenticated;
revoke all on table app_private.platform_audit_events from public, anon, authenticated;

create or replace function app_private.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  select exists (
    select 1
    from app_private.platform_owners po
    where po.profile_id = auth.uid()
      and po.active = true
  );
$$;

revoke all on function app_private.is_platform_owner() from public, anon, authenticated;

-- The client can use this boolean to route an authorized owner to the future
-- platform dashboard. It reveals no owner roster or facility-private data.
create or replace function public.current_user_is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  select app_private.is_platform_owner();
$$;

revoke all on function public.current_user_is_platform_owner() from public;
grant execute on function public.current_user_is_platform_owner() to authenticated;

-- Facility rows contain setup metadata, not member activity. This owner-only
-- RPC will power the platform facility list without granting platform owners
-- direct access to memberships, profiles, workouts, results, or files.
create or replace function public.list_platform_facilities()
returns table (
  facility_id uuid,
  facility_name text,
  facility_slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  return query
  select
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    f.primary_color,
    f.secondary_color,
    f.created_at
  from public.facilities f
  order by f.name, f.created_at;
end;
$$;

revoke all on function public.list_platform_facilities() from public;
grant execute on function public.list_platform_facilities() to authenticated;

commit;
