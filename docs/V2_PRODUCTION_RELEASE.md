# V2 Production Release Runbook

Use this runbook only from `derek/v2-release-hardening`. Production is the
existing Rip City project (`fdzmfohcuratbuitkwoy`) and contains live data.
Staging data and staging seeds must never be copied into production.

## Current Release Evidence

The read-only production preflight passed on 2026-10-23: all 21 required V1
tables and six required private helpers exist; Rip City and the catalog rows
needed by the migrations match expectations; existing goal statuses are
compatible; and none of the checked V2 objects is partially present.

The same preflight recorded this before-migration row-count snapshot:

| Table | Rows |
| --- | ---: |
| `exercise_set_logs` | 6 |
| `exercise_templates` | 93 |
| `facility_members` | 21 |
| `goals` | 0 |
| `group_members` | 14 |
| `groups` | 5 |
| `habit_logs` | 41 |
| `member_profiles` | 20 |
| `profiles` | 21 |
| `workout_assignments` | 4 |
| `workouts` | 4 |

These counts are a timestamped comparison point, not a freeze on legitimate
live activity before release.

The manual production database backup was created and restore-tested on
2026-10-23. The private backup is stored outside Git at
`~/Documents/RipCity-Production-Backup-2026-10-23/` and contains separate
`roles.sql`, `schema.sql`, and `data.sql` exports. SHA-256 checksums were
recorded when the files were created. The exports restored successfully into
an isolated local Supabase stack, and all 11 row counts above matched the
production snapshot exactly. This verifies the application database export;
Auth settings and identities, Storage configuration and objects, and project
redirect settings still require the separate inventory in release step 3.

The separate managed-service inventory on 2026-10-23 found 21 Auth users, one
Storage bucket, and zero Storage objects. Because no uploaded objects exist,
there are no production files to download for this release. The Auth identity
list, bucket configuration, and current Auth URL/provider settings must still
be saved privately outside Git with the database backup.

All 15 approved V2 upgrade migrations were applied successfully to production
in the documented order on 2026-10-23. The post-migration production verifier
then passed all nine checks: required columns, tables, functions, RLS coverage,
non-null unilateral flags, supported goal statuses, and corrected Rip City
exercise defaults. The V2 frontend had not been deployed when these database
checks completed.

## Release Order

The release order is intentionally database first and frontend second. The V2
frontend queries columns, tables, and functions that do not exist in production
yet, so deploying the frontend before the migrations would break live pages.

1. Freeze production schema changes and confirm both contributors approve the
   release commit.
2. In the production Supabase SQL Editor, run
   `sql/diagnostics/preflight_v2_production_release.sql` and save both result
   sets privately. Stop on every `FAIL` or `REVIEW` result.
3. Create and restore-test a private production backup as described in
   `STAGING_RELEASE_CHECKLIST.md`. Also record Auth, Storage, and redirect URL
   settings outside Git. This is mandatory before the first production write.
4. Apply the approved upgrade migrations below one file at a time, in exact
   timestamp order. Stop at the first error and do not deploy the frontend.
5. Run `sql/diagnostics/verify_v2_production_release.sql`. Every row must pass.
6. Complete the focused production database checks for goals, coach invites,
   announcements, lifecycle permissions, group ownership, and workout
   attribution with controlled production test accounts.
7. Confirm production Supabase Auth keeps
   `https://rip-city-training.netlify.app` as its Site URL and permitted redirect
   destination.
8. Open the release PR from `derek/v2-release-hardening` into `main`. Its deploy
   preview must report `window.RIP_CITY_ENVIRONMENT === "staging"`; only the
   exact live hostname is allowed to select production.
9. Merge only after the database and preview gates pass. Immediately perform
   signed-out, admin, coach, athlete, H2K, pending, and inactive smoke tests on
   the live URL.

## Production Upgrade Migrations

Do **not** run `20260816221135_initial_verified_baseline.sql`; it is only for a
new empty project. Do **not** run anything under `supabase/seeds/staging/`.

Apply these files in this order:

1. `20260829140000_add_v2_goals.sql`
2. `20260830120000_add_goal_checkins.sql`
3. `20260914140000_add_unilateral_exercise_flags.sql`
4. `20260914220000_correct_jump_and_med_ball_exercise_defaults.sql`
5. `20260914223000_apply_approved_exercise_input_audit.sql`
6. `20261016120000_add_secure_coach_invites.sql`
7. `20261016200000_harden_secure_coach_invites.sql`
8. `20261016201500_lock_down_coach_invite_writes.sql`
9. `20261018100000_add_targeted_coach_announcements.sql`
10. `20261018103000_fix_targeted_announcement_creation.sql`
11. `20261018110000_add_announcement_audiences_and_dismissals.sql`
12. `20261018113000_add_h2k_announcement_audience.sql`
13. `20261019190000_restrict_member_lifecycle_to_facility_admins.sql`
14. `20261023120000_add_group_creator_permissions.sql`
15. `20261023180000_add_workout_attribution_rpc.sql`

## Data-Preservation Notes

- Goals are retained. Existing `complete` statuses become `completed`, and
  completion timestamps are backfilled from `updated_at` when needed.
- Existing workout exercise rows are retained and receive
  `is_unilateral = false`. Exercise-catalog corrections affect future workout
  selections; historical workout snapshots are intentionally unchanged.
- Existing groups are retained with `created_by = null`, which makes them
  admin-managed. Newly created coach groups record their creator.
- Existing facility memberships and their historical relationships remain in
  place. The lifecycle migration removes ordinary-coach update authority; it
  does not delete or replace memberships.
- Announcements, dismissals, goal check-ins, and coach-invite hardening are
  additive. No staging fixtures or fake identities belong in production.

## Stop And Rollback Rules

- Before frontend deployment, a failed migration means stop, preserve the full
  error, and prepare a reviewed forward fix. Do not improvise edits in the SQL
  Editor and do not rerun the baseline.
- After frontend deployment, revert the Netlify production deploy first if a
  critical app regression appears. Additive database objects may remain while
  a forward fix is reviewed; do not drop tables containing new live writes.
- Treat policy rollback separately from schema rollback. Restoring broader
  coach permissions simply to make an error disappear is not an acceptable
  emergency fix.
- The release owner records the deploy time, migration completion, smoke-test
  results, and any rollback decision in the release PR.
