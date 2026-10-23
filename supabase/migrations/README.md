# Migrations

Files run in timestamp order and are treated as immutable after successful
staging application.

- `20260816221135_initial_verified_baseline.sql` is for a fresh empty project.
- `20261016120000_add_secure_coach_invites.sql` adds seven-day, single-use
  coach invitations, atomic pending-membership claims, and admin-only invite
  management. It does not change reusable member signup links.
- `20261016200000_harden_secure_coach_invites.sql` moves coach-invite secret and
  expiration generation to the database, makes claimed invites irreversible,
  and permits membership-free interrupted signups to retry with a fresh link.
- `20261016201500_lock_down_coach_invite_writes.sql` closes two-step invite
  reopening and reserves direct coach-invite inserts/updates for the trusted
  server-side RPC while preserving existing member-invite table policies.
- `20261018100000_add_targeted_coach_announcements.sql` adds atomic,
  facility-scoped announcements for full-facility, group, and individual
  audiences with optional expiration and recipient-enforced RLS.
- `20261018103000_fix_targeted_announcement_creation.sql` makes the creation
  RPC explicitly facility-scoped and uses its validated server-side transaction
  to bypass the direct-insert policy that rejected every staging coach.
- `20261018110000_add_announcement_audiences_and_dismissals.sql` adds the
  all-athletes audience and private per-member dismissal state used to hide a
  message for the current day.
- `20261018113000_add_h2k_announcement_audience.sql` adds the matching one-click
  all-H2K audience while preserving custom group and individual targeting.
- `20261019190000_restrict_member_lifecycle_to_facility_admins.sql` removes the
  ordinary-coach membership update policy so only facility admins can approve,
  reject, deactivate, reactivate, or change membership roles.
- `20261023120000_add_group_creator_permissions.sql` records group creators and
  restricts coach group/member removal to coach-owned groups while preserving
  full facility-admin management.
- Future changes must use a later UTC timestamp and a descriptive name, such as
  `20260817090000_add_facility_timezone.sql`.

Do not rerun the initial baseline over an existing application schema. Do not
edit it to perform an upgrade; add a new migration instead.
