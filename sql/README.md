# SQL Reference And Diagnostics

Start with `docs/STAGING_DATABASE_SETUP.md` for database setup. Active database
migrations do not live in this folder; they live in `supabase/migrations/`.

## Directory Rules

- `diagnostics/` contains read-only audit, export, comparison, and verification
  tools. Review the target project before running a query.
- `archive/applied/` preserves the component SQL files that were consolidated
  into the verified initial migration. Do not rerun them.
- `archive/proposals/` preserves ideas that were never approved migrations.
  Rework an approved idea into a new timestamped migration.
- `archive/one_time/` preserves staging fixes or troubleshooting SQL that has
  already served its purpose. Do not rerun it.
- `archive/experiments/` contains obsolete prototypes. Never run these files on
  staging or production.

## Current Source Of Truth

`supabase/migrations/20260816221135_initial_verified_baseline.sql` is the
verified fresh-project baseline. It successfully recreated the audited V1
structure in Rip City Staging on 2026-08-16 and passed every check in
`sql/diagnostics/verify_staging_baseline.sql`.

Future schema changes must be new timestamped files in `supabase/migrations/`.
Do not edit the verified baseline to represent an upgrade to an existing
database.

## Safety

- Staging receives migrations before production.
- Staging contains only fake people and activity data.
- Production SQL requires an explicit migration, backup/recovery check, and
  release checklist.
- Database passwords, secret keys, and `service_role` keys never belong in Git.
