# Codex Handoff - Rip City App

This file is the quick-start context for future Codex sessions. Read this before changing code.

## Current Repo / Branch Setup

Project folder on Derek's Mac:

- `/Users/derekparis/RipCity-App`

Git branches:

- `main` = live production branch deployed by Netlify.
- `v2-development` = next-version work branch.
- Derek and Sam work from feature branches such as `derek/facility-config` or
  `sam/goals-v2`, then open pull requests into `v2-development`.
- Follow `CONTRIBUTING.md` for the shared branch, review, migration, and merge
  workflow.

Netlify:

- Production deploy should point at `main`.
- The separate V2 staging site is `https://ripcitystaging.netlify.app` and
  deploys `v2-development`.
- Pull requests into `v2-development` receive public Netlify Deploy Previews
  after Netlify sees a push to the PR branch.
- Follow `docs/STAGING_RELEASE_CHECKLIST.md` for preview, migration, recovery,
  and post-deploy checks.
- `codex-ui-polish` was the old production branch name and has been retired/deleted after `main` was updated.
- `codex/beta-next` was renamed/deleted in favor of `v2-development`.

Before production changes:

1. Make small fixes on `main` only when they are needed for the live beta.
2. Put larger product work on `v2-development`.
3. Merge `main` into `v2-development` after hotfixes so V2 does not fall behind production.

## Files To Read First

Before making product/code changes, read:

- `docs/BUILD_PLAN.md`
- `docs/VERSION_2_PLAN.md`
- this file

Read `docs/VERSION_3_PLAN.md` only when planning work beyond the active V2
scope or deciding where a newly proposed feature belongs.

For database/RLS work, also inspect:

- `docs/SUPABASE_SETUP.md`
- `docs/PRODUCT_DECISIONS.md`
- `docs/PERMISSIONS_MATRIX.md`
- `supabase/migrations/`
- `sql/README.md` and `sql/diagnostics/`

For current implementation order and work status, read:

- `docs/V2_BACKLOG.md`

## Big Product Direction

Rip City is the first beta facility, not the full product identity.

The real product should become a customizable coaching/member platform for many facilities. Facilities should eventually be able to choose modules, colors, logo, groups, member types, terminology, and setup options without custom code every time.

Core direction:

- Facility-isolated platform foundation first.
- Rip City configuration second.
- H2K habits are an optional/member-type-specific module, not the whole app.
- Facility data must stay isolated.
- Facility coaches/admins should only manage their own facility.
- Members should only see their own facility experience.
- V2 uses one active facility membership per account. Future platform and
  baseball-development work is defined in `docs/VERSION_3_PLAN.md`.

## Current V2 Priorities

See `docs/VERSION_2_PLAN.md` for detailed product requirements and
`docs/V2_BACKLOG.md` for the maintained implementation order and status. Current
build order:

1. Document platform foundations: permissions, lifecycle, signup links, modules,
   facility time zones, testing, accessibility, and notifications.
2. Audit the live production schema read-only against every SQL file and app query.
3. Create staging Supabase and a reproducible rebuild/release-safety workflow.
4. Verify two-facility isolation using entirely fake staging data.
5. Complete V2 single-facility config and codebase cleanup audits; preserve the
   second staging facility for isolation testing.
6. Finish beta feedback polish that affects daily use.
7. Continue with goals, coach member detail, leaderboards, progress, notes, and
   profile/community work in the order defined by `docs/VERSION_2_PLAN.md`.

Current signup-link decision:

- Preserve the V1 coach workflow that copies Athlete, H2K, or general signup links.
- Those member links remain reusable for group emails, and every resulting
  signup still requires approval.
- Coach onboarding is separate: a facility admin creates a seven-day,
  single-use link; claiming it creates pending coach access; and a facility
  admin must approve it. `facility_invites` powers only this secure coach flow.
- The coach-invite implementation is on `derek/facility-access`. Its migration
  was applied to staging and all 12 coach-invite/RLS checks passed on
  2026-10-16. The staging browser flow also passed that day. Production remains
  unchanged.
- Copilot review produced a follow-up hardening migration,
  `20261016200000_harden_secure_coach_invites.sql`. It was applied to staging
  on 2026-10-16, and the expanded 14-check coach-invite suite passed. The
  updated UI uses its server-side invite RPC. Production remains unchanged.
- A second Copilot hardening pass produced
  `20261016201500_lock_down_coach_invite_writes.sql`. It was applied to staging
  on 2026-10-16, and the expanded 16-check suite passed. Production remains
  unchanged.
- The same branch adds status-specific blocked-account messaging and admin-only
  coach deactivation/reactivation. These updates reuse existing membership rows
  so account, member-profile, group, and historical relationships remain intact.
  All 20 account-lifecycle staging checks passed on 2026-10-16 and restored the
  temporarily changed fake-account statuses.

Production Supabase audit status:

- A read-only live audit was completed on 2026-08-08 and is recorded in
  `docs/SUPABASE_AUDIT_2026-08-08.md`.
- The verified initial migration recreated all 21 public tables and passed the
  full staging verification suite on 2026-08-16.
- Production has no recorded Supabase migrations and the Free plan provides no
  scheduled dashboard backups.
- Staging now has narrower exercise-library grants and short canonical policy
  names. Production remains unchanged until a separate release is approved.

## V2 Cleanup Track

Derek wants a cleanup pass before the app grows too much.

Important cleanup goals:

- SQL organization completed 2026-08-16: active migrations now live under
  `supabase/migrations/`; diagnostics and clearly labeled archives live under
  `sql/`.
- Keep current guidance easy to find and move useful completed version notes
  into `docs/archive/`; delete obsolete notes that Git history already preserves.
- Add helpful comments around complicated Supabase, RLS, assignment, habit scoring, workout logging, and aggregation logic.
- Reduce repeated code where it is safe.
- Split huge JS files only when it clearly improves maintainability.
- Do not do broad formatting-only rewrites unless agreed first.
- Preserve production behavior.

## Staging Supabase Direction

V2 should create a second Supabase project before risky schema/product changes.

Current status:

- The staging project was created on 2026-08-16 as **Rip City Staging**.
- Staging project reference: `xjgmjliqqkhfnqphigbk`.
- Automatic RLS is enabled.
- `v2-development` points to staging through `js/shared/supabaseClient.js`.
- The repository-generated baseline was installed and fully verified on
  2026-08-16: 21 public tables, 194 columns, 55 indexes, 93 public-table RLS
  policies, 18 private helpers, required Storage setup, and all expected grants
  and Rip City starter configuration passed.
- Staging currently has nine documented fake Auth users plus fake workout and
  activity data used for V2 testing. Continue using only fake people and
  activity data.
- Staging Auth uses `https://ripcitystaging.netlify.app` as its Site URL and
  allows the stable staging domain, all Netlify Deploy Preview subdomains, and
  optional localhost port `3000`. Email signups are enabled; email confirmation
  and anonymous sign-ins are disabled.
- The staging-only two-facility seed passed on 2026-08-28. Rip City has its five
  groups and six H2K habits; Test Facility Alpha has two athlete groups and no
  H2K habits.
- The staging test-account fixture started with nine fake profiles and ten
  memberships. The obsolete Alpha membership for `rccoach@example.com` was
  removed from the maintained fixture on 2026-10-18; each of the nine V2 test
  identities now belongs to one facility.
- The optional leaderboard demo fixture is maintained at
  `supabase/seeds/staging/v2/03_leaderboard_demo_data.sql`. It was applied and
  verified in staging on 2026-10-15: 10 display-only members, 728 marked habit
  logs, 50 workout assignments, and 38 completed assignments. It provides
  six-person rankings, ties, streaks, attendance, and no-score states.
- Manual role smoke tests passed, followed by all 45 automated read-only RLS
  checks. The shared pending/inactive message is being replaced by distinct
  lifecycle states on `derek/facility-access`; facility selection is V3 scope.
- The unilateral-exercise migration was applied to staging on 2026-09-14. It
  adds non-null `is_unilateral` flags to exercise templates and workout
  exercise snapshots; production remains unchanged.
- The approved Vertical Jump and medicine-ball catalog migration
  (`20260914220000_correct_jump_and_med_ball_exercise_defaults.sql`) was applied
  successfully to staging on 2026-09-14. Staging now has 88 Rip City starter
  exercises; production remains unchanged.
- The follow-up approved exercise-input audit migration
  (`20260914223000_apply_approved_exercise_input_audit.sql`) was applied and
  verified successfully in staging on 2026-09-14. It does not rewrite existing
  workout snapshots, and production remains unchanged.

Goal:

- Production Supabase remains connected to the live V1 beta.
- Staging Supabase is used for V2 schema changes, RLS testing, fake users, fake facilities, fake workouts, and destructive cleanup tests.

Database change flow:

1. Create migration file in repo.
2. Run it on staging.
3. Test coach, H2K member, athlete, and pending-user flows.
4. Confirm RLS still blocks unauthorized access.
5. Only then run the approved migration on production.

## Live Beta Notes

Current live beta is being used by Rip City coaches/members.

Be careful with production:

- Do not run destructive SQL against production.
- Do not change production schema without an explicit migration and checklist.
- Do not break signup, login, approval, workout builder, member dashboard, workout session, habit logging, profile, or RLS.
- Small live fixes can go to `main`; larger work belongs on `v2-development`.

## Known Product Decisions

Goals:

- Members can create their own goals.
- Coaches can create goals for facility members.
- Members only see their own goals.
- Coaches can see member-created goals in their facility.
- Members can fully edit/delete their own goals.
- Members can only update status on coach-created goals.
- Completed goals should be collapsed so pages do not get bulky.

Leaderboards:

- Member-facing leaderboards show top 5 only.
- Members can see their own rank if not top 5.
- H2K and athlete leaderboards should be split for members.
- Coaches can see both within their facility.
- Tied scores share rank.
- Rows should show full name and profile picture.
- H2K streak = consecutive days with at least 4 checked behaviors.
- Athlete streak = assigned workout days completed.
- Rolling 4-week H2K average is important to the coach.

Workout assignments:

- Multiple active coaches/admins in the same facility may assign authorized
  workouts, including workouts created by another coach.
- Member and coach views should show the assigning coach using the existing
  `workout_assignments.assigned_by` relationship.
- Add database-safe duplicate prevention and same-facility/cross-facility
  multi-coach staging tests before production release.

Coach onboarding:

- Derek/platform owner creates the facility and establishes its first admin.
- Facility admins create/invite or approve additional coaches for their own
  facility.
- Ordinary coaches may approve ordinary members but cannot approve, create, or
  promote coach/admin memberships.
- A shared signup link never grants an elevated role without admin approval.

Testing Days:

- A proposed coach-run Testing Day workflow would support ordered tests,
  group/member selection, roster-style result entry, progress history, and
  future leaderboard metrics.
- The exact tests, attempts/best-result behavior, permissions, visibility, and
  V2-versus-V3 boundary are pending Derek's Rip City coach discussion on
  2026-10-18.

Coach notes / announcements:

- Coach notes are private/internal.
- All facility coaches/admins can read notes.
- Coaches can only edit/delete their own notes.
- Announcements are visible to members and show who they are from.
- Announcements can target facility, group, or member.
- Members can dismiss announcements.
- Coach profiles need name/profile picture for announcements/community.

## Derek / Sam Contributor Workflow

Sam is now an active contributor. Derek and Sam are building the product
together and may both work across frontend code, migrations, RLS, and staging.
Neither contributor is limited to one technical area.

- Use a separate feature branch for each focused unit of work.
- Open a draft pull request into `v2-development` after the first commit.
- Communicate before applying staging migrations or changing shared Supabase
  behavior.
- Keep one active staging schema migration in flight at a time.
- Have the other contributor review and test before squash-merging.
- Keep `main` as production and merge approved production hotfixes back into
  `v2-development`.
- Follow `CONTRIBUTING.md` as the maintained source of truth.

## Local Dev Notes

Derek renamed the folder from `RipCity-Version1` to `RipCity-App`.

If a Codex session still has old workspace permissions, it may need approval to edit files in the new path. Starting a fresh Codex session from `/Users/derekparis/RipCity-App` should fix that.

Common local testing:

- VS Code Live Server often runs on port `5500`.
- The shared local server runs on port `3000`; stop it when not needed.
- Use `git switch v2-development` for V2 work.
