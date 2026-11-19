# Database Tests

This directory is reserved for repeatable schema and RLS tests. Initial manual
verification remains in `sql/diagnostics/verify_staging_baseline.sql`.

The source-controlled programming-calendar contract can be checked before its
staging migration is applied:

```bash
node tests/workout-programming.test.mjs
```

After applying `20261108170000_add_workout_programs.sql`,
`20261109120000_harden_program_ownership_and_calendar_copy.sql`, and
`20261109210000_link_programs_and_expand_calendar_copy.sql` to staging in that
order, manually verify:

- A coach can create, edit, archive, and launch their own program.
- That coach cannot see or operate another coach's program.
- A facility admin sees every facility program, can filter by creator, and can
  edit, archive, or launch any of them.
- Neither role can read or operate another facility's programs.
- Group and individual calendars include inherited assignments but only allow
  direct assignments to be copied.
- Copy Week, Copy Month, and Copy Selected preserve date spacing, support
  multiple group/member destinations, refuse occupied dates, and create
  independently editable workouts without changing the source program.
- Editing a program updates only its future unstarted linked occurrences; past,
  started, and completed workout history remains unchanged.

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

This legacy read suite does not grant or test platform-owner access; that
authorization is covered by the focused suite below.

Status: all 45 read checks passed against Rip City Staging on 2026-08-28.

## Platform-Owner Foundation Checks

After applying `20261108150000_add_platform_owner_foundation.sql` and granting
the documented staging-only owner fixture, run:

```bash
node supabase/tests/staging_platform_owner_foundation_checks.mjs
```

The test proves that the staging platform-owner fixture can invoke owner-only
facility operations, while another facility admin and an ordinary coach cannot.
It also proves that platform ownership does not bypass cross-facility member
RLS, does not permit direct facility inserts, and does not expose the private
platform-owner roster through the REST API.

Status: the complete platform-owner foundation suite passed against Rip City
Staging on 2026-11-08.

## Facility Configuration Checks

After applying `20261108160000_add_facility_configuration.sql`, run:

```bash
node supabase/tests/staging_facility_configuration_checks.mjs
```

The test proves that existing facilities receive complete default module and
program configuration, approved users can read only their own facility setup,
and only a platform owner can replace configuration. It temporarily changes
Test Facility Alpha's branding, timezone, terminology, module visibility, and
program visibility, then restores the original configuration in cleanup.

Status: the complete facility-configuration suite passed against Rip City
Staging on 2026-11-08, including successful restoration of Test Facility
Alpha's original configuration.

## Facility-Aware Signup Checks

After applying `20261108170000_add_facility_aware_signup.sql`, run:

```bash
node supabase/tests/staging_facility_signup_checks.mjs
```

The test verifies that anonymous visitors receive only safe branding and
enabled-program data for an active facility, unknown slugs return nothing, a
retry preserves the existing same-facility pending rows, and an existing
account cannot use a different facility signup link to create a cross-facility
membership.

## Platform Facility Provisioning Checks

After applying `20261108180000_add_platform_facility_provisioning.sql`, run:

```bash
node supabase/tests/staging_platform_facility_provisioning_checks.mjs
```

The repeatable test proves that only a platform owner can create a configured
facility or enter its admin mode, that admin mode uses an explicit approved
facility membership, and that another facility's member cannot read the new
configuration. The first successful run retains the fake `Platform Launch
Rehearsal` facility for the complete second-facility launch rehearsal.

## Goals CRUD And RLS Checks

## Platform First-Admin Invite Checks

After applying `20261108190000_add_platform_admin_invites.sql`, run:

```bash
node supabase/tests/staging_platform_admin_invite_checks.mjs
```

The test proves that only a platform owner can create the seven-day link, the
public lookup reveals only safe facility branding, the link is single-use, and
claiming it creates only pending administrator access. It also verifies that an
ordinary coach and another facility's admin cannot approve the request, while
the platform owner in explicit facility admin mode can approve it. Test rows
are removed during cleanup.

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

## Athlete Habits And Workout Attribution Checks

After applying `20261023180000_add_workout_attribution_rpc.sql`, run:

```bash
node supabase/tests/staging_athlete_habits_attribution_checks.mjs
```

The focused staging test verifies that a Rip City athlete can read and write
the same facility-scoped habits as an H2K member, members can retrieve creator
and assigner display names only for visible workout assignments, another
facility cannot retrieve those names, and a Rip City coach retains shared
facility workout visibility. Its temporary habit log is removed in cleanup.

Status: all focused athlete-habit and workout-attribution checks passed against
Rip City Staging on 2026-10-23, and the temporary habit log was cleaned up.

## Admin-Assigned Signup Group Checks

After applying `20261023210000_admin_assign_signup_groups.sql` and
`20261024120000_admin_assign_all_member_signup_groups.sql` in order, run:

```bash
node supabase/tests/staging_signup_group_approval_checks.mjs
```

The test uses the pending Rip City athlete and approved H2K fixtures plus
temporary matching groups. It proves pending members cannot self-assign,
ordinary coaches cannot approve, wrong-program and cross-facility groups are
rejected, direct group-less approval is blocked, and a facility admin can
atomically assign the correct initial group and approve either member type.
Cleanup restores both fixtures and removes the temporary groups.

Status: all 19 expanded athlete/H2K signup-group checks passed against Rip City
Staging on 2026-10-24. Both fixture accounts were restored and both temporary
groups were removed.

## Member Leaderboard Privacy Checks

After applying `20261024150000_add_member_habit_leaderboards.sql`, run:

```bash
node supabase/tests/staging_member_leaderboard_rls_checks.mjs
```

The staging-only test verifies that Athlete and H2K rankings remain separate,
Test Facility Alpha remains isolated, members can scope only to groups they
belong to, coaches cannot use the member-only RPC, and each response contains
only top-five positions plus the caller's own position.

Status: all 25 member-leaderboard privacy and RLS checks passed against Rip
City Staging on 2026-10-24.

## Testing Day Scheduling And RLS Checks

After applying the Testing Day foundation, save-fix, staff-result, and completed-workflow migrations, run:

```bash
node supabase/tests/staging_testing_days_rls_checks.mjs
```

The staging-only test creates and cleans up one scheduled Testing Day. It
verifies coach/admin scheduling and result entry, overlapping group/member
deduplication, assigned-member schedule visibility, another-facility denial,
one canonical result per participant/test, member-own result visibility,
absence/Not Tested states, guarded completion, and denial of direct writes and
member result entry.

## Versioned Legal Acceptance Checks

After applying `20261025120000_add_versioned_legal_acceptances.sql`, run:

```bash
node supabase/tests/staging_legal_acceptance_checks.mjs
```

The staging test verifies the current document versions, guardian permission
for a 13–17 user, direct-write denial, RPC idempotency, and private acceptance
visibility. It records the initial beta acceptance for all nine standard fake
staging accounts so normal staging QA can continue through the new gate. Those
accounts will therefore skip the required-review screen after this test passes.

To manually verify the existing-account screen again, delete the chosen fake
account's acceptance row in the **staging SQL editor only**, then sign in or
refresh a protected page. For example:

```sql
delete from public.legal_acceptances
where user_id = (
  select id from auth.users where email = 'rcathlete@example.com'
);
```

Never use that reset query in production; production acceptance history is
append-only evidence and must be retained.

## Atomic Member Signup Completion Checks

After applying `20261102120000_add_atomic_member_signup_completion.sql`, run:

```bash
node supabase/tests/staging_atomic_signup_completion_checks.mjs
```

The staging test uses the pending Rip City member fixture and calls the signup
completion operation twice. It verifies both retries preserve the existing
membership and member-profile IDs, leave exactly one of each row, and reject a
retry that attempts to replace the saved username. It does not send Auth email
and does not change fixture status or relationships.

## Workout Ownership Checks

After applying `20261115120000_restrict_workout_assignment_ownership.sql`, run:

```bash
node supabase/tests/staging_workout_ownership_checks.mjs
```

The staging test verifies that coaches can still view shared facility workouts
but can assign, unassign, and delete only workouts they created. It also verifies
that facility admins can assign, unassign, and delete any workout in their
facility. Temporary workout and assignment fixtures are removed after the test.

## Programming Hardening (2026-11-16)

Apply `supabase/migrations/20261116120000_harden_programming_security_and_lifecycle.sql`
only to Rip City Staging (`xjgmjliqqkhfnqphigbk`) after all earlier migrations.
It is transactional and forward-only. Existing applied migrations are unchanged.

Local validation:

```bash
node --test tests/*.test.mjs
```

After applying, run `node supabase/tests/staging_workout_ownership_checks.mjs`.
The expanded checks cover immutable attribution, saved-workout preservation on
assignment replacement, and parent-workout assignment cascades.

Also verify against staging before merging:

- Launch a coach-owned program as an admin, then update it as its creator.
  Add, move, and remove future unstarted slots; verify the calendar refreshes.
- Send two simultaneous copy RPCs to the same empty roster/date. Exactly one
  succeeds and the other reports an occupied destination, with no partial copy.
- Confirm copies have `workout_kind = 'assignment_snapshot'` and do not appear
  in the reusable Workout Library.
- Refresh an unstarted program occurrence twice; confirm exercises do not
  accumulate with null block IDs. Preserve exercises that have recorded results.
- Remove staff approval and confirm program reads and mutation RPCs are denied.
- Obtain a fresh Copilot review on the final PR diff.

Status: all 18 local test files pass. Derek reported successful staging migration
application and a fully passing ownership-test rerun on 2026-11-16. This covers
immutable attribution, assignment ownership, saved-workout preservation, and
parent-workout assignment cascades. The cascade fixture uses a minimal-return
insert followed by a separate read, matching the earlier assignment fixtures.
Live program/copy, exercise-cleanup, and revoked-staff checks above, plus a fresh
Copilot review, remain pending before merging.
