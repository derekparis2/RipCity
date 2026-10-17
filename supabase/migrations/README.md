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
- Future changes must use a later UTC timestamp and a descriptive name, such as
  `20260817090000_add_facility_timezone.sql`.

Do not rerun the initial baseline over an existing application schema. Do not
edit it to perform an upgrade; add a new migration instead.
