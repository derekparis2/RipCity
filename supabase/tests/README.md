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

## Coach Invite And Approval Checks

After applying `20261016120000_add_secure_coach_invites.sql` and
`20261016200000_harden_secure_coach_invites.sql` in order, run:

```bash
node supabase/tests/staging_coach_invite_rls_checks.mjs
```

The staging-only test creates and cleans up one coach invite and coach
membership. It verifies that coach links are single-use, create only pending
coach access, and require approval from an administrator in the invited
facility. It also verifies server-generated expiration, irreversible claims,
and that ordinary coaches and other-facility admins cannot approve the request.

Status: all 14 coach-invite, server-expiration, irreversible-claim, and approval
checks passed against Rip City Staging on 2026-10-16 after both migrations were
applied.

## Account Lifecycle Checks

Run the staging-only lifecycle test with:

```bash
node supabase/tests/staging_account_lifecycle_checks.mjs
```

The test temporarily rejects the pending Rip City fixture, reactivates the
inactive Rip City member, and deactivates/reactivates the Alpha coach. It
verifies the correct RLS access at each status and proves that reactivation
uses the same membership, member profile, and group relationships. A `finally`
cleanup restores every fixture to its original status even if a check fails.

Status: all 20 account-lifecycle checks passed against Rip City Staging on
2026-10-16, and all temporary fixture-status changes were restored.
