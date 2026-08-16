# Migrations

Files run in timestamp order and are treated as immutable after successful
staging application.

- `20260816221135_initial_verified_baseline.sql` is for a fresh empty project.
- Future changes must use a later UTC timestamp and a descriptive name, such as
  `20260817090000_add_facility_timezone.sql`.

Do not rerun the initial baseline over an existing application schema. Do not
edit it to perform an upgrade; add a new migration instead.
