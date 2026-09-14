# Database Tests

This directory is reserved for repeatable schema and RLS tests. Initial manual
verification remains in `sql/diagnostics/verify_staging_baseline.sql`.

## Staging RLS Read Checks

After applying the two V2 staging seeds and creating the documented fake Auth
accounts, run:

```bash
node supabase/tests/staging_rls_read_checks.mjs
```

Enter the shared staging-only password when prompted. The script does not store
or print it. It signs into all nine fake accounts and runs read-only checks for:

- Facility-admin and coach facility scope.
- Member self-only profile/member-profile visibility.
- Pending and inactive protected habit denial.
- Rip City versus Test Facility Alpha isolation.
- The approved cross-facility coach scenario.

The test targets only the hardcoded Rip City Staging reference and publishable
key. It performs no insert, update, or delete operations.

Platform-owner coverage remains pending its V2 migration and test identity.

Status: all 45 read checks passed against Rip City Staging on 2026-08-28.

## Goals CRUD And RLS Checks

After applying the V2 Goals migration, run:

```bash
node supabase/tests/staging_goals_rls_checks.mjs
```

This staging-only test creates and cleans up fake goals while verifying member
ownership, status-only updates to coach-created goals, and cross-facility write
denial.
