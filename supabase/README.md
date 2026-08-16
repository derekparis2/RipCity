# Supabase Source Of Truth

This directory contains active, ordered database work.

- `migrations/` contains immutable timestamped schema migrations.
- `seeds/` is reserved for required configuration and clearly labeled fake
  staging/test data.
- `tests/` is reserved for repeatable schema and RLS regression checks.

The project is not yet linked to the Supabase CLI. Until that workflow is
reviewed, follow `docs/STAGING_DATABASE_SETUP.md` and run an approved migration
manually in the staging SQL Editor. Never guess an execution order from files
under `sql/archive/`.

## Migration Rules

1. Create a timestamped migration in `supabase/migrations/`.
2. Review grants, RLS, facility scope, lifecycle behavior, and rollback impact.
3. Run it on Rip City Staging.
4. Run the relevant files under `supabase/tests/` and `sql/diagnostics/`.
5. Test every affected app role and cross-facility boundary.
6. Only then prepare a separately approved production release.
