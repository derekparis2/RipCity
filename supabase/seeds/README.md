# Seeds

Keep seed data separate from schema migrations whenever practical.

- Required configuration must be deterministic and safe to recreate.
- Staging/test seeds must be unmistakably fake.
- Never copy real members, Auth identities, workout logs, notes, or other
  production activity into staging.
- Mutable facility content belongs in production backups unless it is
  intentionally promoted into maintained default configuration.

The verified initial baseline currently includes the original required Rip City
configuration.

## Current Staging Seed

Staging-only fixtures live under versioned folders and must never be included in
a production release. The current V2 order is:

1. `staging/v2/01_two_facility_foundation.sql`
2. Create the nine fake Auth identities documented in
   `docs/STAGING_TEST_ACCOUNTS.md`.
3. `staging/v2/02_test_account_profiles.sql`
4. `staging/v2/03_leaderboard_demo_data.sql`
5. `staging/v2/04_remove_cross_facility_coach_fixture.sql` only when upgrading
   an older staging database that received the obsolete shared-coach fixture

`01_two_facility_foundation.sql` adds one unmistakably fake second facility and
two fake athlete groups. Run it only in **Rip City Staging**, after the verified
baseline and before creating fake Auth users.

The seed contains a fail-closed guard. It requires the exact empty baseline
shape, including zero Auth users, zero application profiles, the Rip City
facility, and 88 starter exercises. It aborts instead of writing if those safety
conditions do not match.

The fake second facility intentionally receives no Rip City habit definitions.
Configurable habit modules for other facilities remain V3 scope, and this
scenario helps prove Rip City habits do not leak into another facility.

Status: successfully applied and verified in Rip City Staging on 2026-08-28.

`02_test_account_profiles.sql` is the next staging-only fixture. After the
nine fake, auto-confirmed Auth identities in `docs/STAGING_TEST_ACCOUNTS.md`
exist, it creates their application profiles, facility roles/statuses, member
profiles, and group memberships. It resolves Auth IDs by fake email and stores
no password. Each V2 identity belongs to one facility.

Status: successfully applied and verified in Rip City Staging on 2026-08-28.
The maintained result is nine application profiles and nine facility
memberships. Older staging databases should run
`04_remove_cross_facility_coach_fixture.sql` once to reach this shape.

Status: the staging correction was applied on 2026-10-18. The Rip City coach
now belongs only to Rip City; Test Facility Alpha retains its dedicated admin,
coach, and athlete accounts.

`03_leaderboard_demo_data.sql` is an optional, repeatable staging fixture for
leaderboard QA. Run it after `02_test_account_profiles.sql`. It adds five fake
display-only H2K members and five fake display-only athletes without creating
more Auth accounts, then generates equivalent habit scores, streaks, and ties
for both programs plus workout-review assignments and completions relative to
the day the fixture is run. The existing `rch2k@example.com` and
`rcathlete@example.com` accounts remain the login-capable member test paths.

The fixture deletes and rebuilds only its own marked habit rows and fixed-ID
workout. It must never be run in production.

Status: refreshed and verified in Rip City Staging on 2026-10-23 after the
shared-habits update. The result was 10 display-only members, 1,464 fixture
habit logs, 50 fixture assignments, and 38 completed fixture assignments.
