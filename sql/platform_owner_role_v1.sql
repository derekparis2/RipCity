-- =====================================================
-- PLATFORM OWNER ROLE PROPOSAL
-- =====================================================
-- Proposed migration only. Do not run until reviewed in staging.
--
-- Why this is needed:
-- Facility coaches/admins should manage only their own facility. The platform
-- owner needs a separate global role for cross-facility support, onboarding,
-- billing, and tenant administration.
--
-- Current schema note:
-- profiles.global_role is currently constrained to member/coach/admin. That is
-- not enough to distinguish a facility admin from the platform owner.

alter table public.profiles
  drop constraint if exists profiles_global_role_check;

alter table public.profiles
  add constraint profiles_global_role_check
  check (global_role in ('member', 'coach', 'admin', 'platform_owner'));

-- After this migration is approved and run, set only Derek's profile to:
-- update public.profiles
-- set global_role = 'platform_owner'
-- where email = 'derekparis82@gmail.com';
--
-- Do not grant platform_owner to facility coaches/admins. Facility-level roles
-- should continue to live in facility_members.role and remain scoped by
-- facility_members.facility_id.

