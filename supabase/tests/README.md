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
- Cross-facility denial between the dedicated Rip City and Alpha accounts.

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
`20261016200000_harden_secure_coach_invites.sql`, then
`20261016201500_lock_down_coach_invite_writes.sql` in order, run:

```bash
node supabase/tests/staging_coach_invite_rls_checks.mjs
```

The staging-only test creates and cleans up one coach invite and coach
membership. It verifies that coach links are single-use, create only pending
coach access, and require approval from an administrator in the invited
facility. It also verifies server-generated expiration, RPC-only protected
metadata writes, irreversible claims, and that ordinary coaches and
other-facility admins cannot approve the request.

Status: all 16 coach-invite, server-expiration, protected-write,
irreversible-claim, and approval checks passed against Rip City Staging on
2026-10-16 after all three migrations were applied.

## Account Lifecycle Checks

Run the staging-only lifecycle test with:

```bash
node supabase/tests/staging_account_lifecycle_checks.mjs
```

The test temporarily rejects the pending Rip City fixture, reactivates the
inactive Rip City member, and deactivates/reactivates the Alpha coach. It also
proves that an ordinary coach cannot approve a pending member or deactivate an
approved member. It verifies the correct RLS access at each status and proves that
reactivation uses the same membership, member profile, and group relationships.
A `finally` cleanup restores every fixture to its original status even if a
check fails.

Status: all 25 account-lifecycle checks passed against Rip City Staging on
2026-10-23 after admin-only member lifecycle enforcement was applied, and all
temporary fixture-status changes were restored.

## Group Ownership Checks

After applying `20261023120000_add_group_creator_permissions.sql`, run:

```bash
node supabase/tests/staging_group_ownership_checks.mjs
```

The test creates temporary admin-owned and coach-owned groups. It proves that
coaches can add members to facility groups but can remove members or delete a
group only when they created that group. It also verifies that facility admins
retain full removal access and that cross-facility access stays blocked. A
`finally` cleanup removes all temporary groups.

Status: all 15 group-ownership checks passed against Rip City Staging on
2026-10-23, and all temporary groups and memberships were cleaned up.

## Targeted Announcement Checks

After applying `20261018100000_add_targeted_coach_announcements.sql`,
`20261018103000_fix_targeted_announcement_creation.sql`, and
`20261018110000_add_announcement_audiences_and_dismissals.sql`, then
`20261018113000_add_h2k_announcement_audience.sql` in order, run:

```bash
node supabase/tests/staging_announcements_rls_checks.mjs
```

The staging-only test creates and cleans up facility, all-athlete, all-H2K,
group, and individual announcements. It verifies member/coach write
permissions, Rip City versus Alpha isolation, recipient-only visibility, daily
dismissal privacy, and facility-admin deletion.

Status: all 26 targeted-announcement checks passed against Rip City Staging on
2026-10-18 after all four announcement migrations were applied. This includes
the reversible member-dismissal flow and isolated all-athlete/all-H2K
audiences. All temporary announcements and dismissals were cleaned up.
