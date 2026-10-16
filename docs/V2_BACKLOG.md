# Version 2 Work Backlog

This is the short, ordered list Derek and Sam use to decide what to work on
next. Detailed product behavior stays in
[`VERSION_2_PLAN.md`](VERSION_2_PLAN.md); each work package below links to its
relevant plan sections.

Do not create or assign branches ahead of time. When someone picks up the next
package, they create its branch from the latest `v2-development` and replace
`<name>` in the suggested branch name with their own name.

## How To Use This List

1. Finish and merge the package currently in review.
2. Pick the highest package marked **Ready** that does not conflict with active
   work.
3. Add the owner, actual branch, and pull-request link when work begins.
4. Change the status to **In review** while implementation or testing is still
   receiving feedback.
5. After implementation and required staging tests pass, mark the package
   **Complete** in that same feature branch before requesting final approval.
   Squash-merging the pull request then brings the completed status into
   `v2-development` with the work it describes.

Only one branch that changes the staging database schema should be active at a
time. A documentation, deployment, or frontend-only package may run alongside
it when the contributors confirm their files and behavior do not overlap.

---

## 1. Contributor And Staging Foundation

- **Status:** Complete
- **Branch:** `derek/contributor-foundation`
- **Plan detail:** [Staging and release safety](VERSION_2_PLAN.md#7-staging-and-release-safety) · [Codebase cleanup](VERSION_2_PLAN.md#9-codebase-cleanup-and-maintainability)

This package establishes the shared branch/review process, organizes the repo,
rebuilds staging from source-controlled SQL, creates the fake two-facility test
foundation, and verifies baseline read access and isolation.

**Completed:** The contributor workflow, repository cleanup, reproducible
staging baseline, fake two-facility fixtures, manual role smoke tests, and all
45 automated read-only RLS checks are documented, verified, and merged into
`v2-development`.

---

## 2. Staging Preview And Release Safety

- **Status:** Complete
- **Branch:** `derek/staging-deployment`
- **Plan detail:** [Staging and release safety](VERSION_2_PLAN.md#7-staging-and-release-safety) · [Regression and release checklist](VERSION_2_PLAN.md#v2-regression-and-release-checklist) · [Accessibility standard](VERSION_2_PLAN.md#accessibility-standard)

This package makes the staging environment usable and repeatable for both
contributors. It includes the shared non-production web preview, staging-only
Supabase/Auth configuration, the regression and accessibility checklist,
migration verification, manual backup/recovery instructions, rollback guidance,
and post-deploy smoke tests.

**Completed:** The shared staging site, pull-request preview rules, staging Auth
configuration, migration/recovery guidance, accessibility checks, and
post-deploy workflow are documented and merged into `v2-development`.

---

## 3. Goals And Coach Member Detail

- **Status:** Complete
- **Branch:** `Sbell/Goals`
- **Plan detail:** [Goals](VERSION_2_PLAN.md#2-goals) · [Coach member-detail requirements](VERSION_2_PLAN.md#first-ui-version)

This is one complete Goals feature rather than separate tiny database and UI
branches. It includes the approved goal fields, member-created and coach-created
goals, creator-specific edit/delete rules, status and completion history,
confirmations, the coach member-detail foundation needed to manage goals, RLS,
and two-facility create/read/update/delete tests.

**Completed:** Members and coaches have the approved goal creation, progress,
status, and ownership workflows; coach member detail is available; goal
check-ins and facility-scoped RLS were added; and the reviewed branch was merged
into `v2-development`.

---

## 4. Facility Access And Account Lifecycle

- **Status:** Planned
- **Suggested branch:** `<name>/facility-access`
- **Plan detail:** [Roles and permissions](VERSION_2_PLAN.md#v2-roles-and-permissions-foundation) · [Lifecycle rules](VERSION_2_PLAN.md#lifecycle-rules) · [Platform done criteria](VERSION_2_PLAN.md#done-criteria)

This package makes multi-facility access intentional. It includes the storable
Derek-only platform-owner role, safe facility administration, an active-facility
selector for legitimate multi-facility accounts, correct pending/rejected/
inactive experiences, and deactivate/reactivate behavior that restores history.
It also adds the facility-admin-controlled coach onboarding path: the platform
owner establishes the first facility admin; facility admins can invite/create
or approve coaches for their own facility; ordinary coaches cannot approve or
promote coach/admin memberships.

**Complete when:** Every account operates only inside its selected authorized
facility, inactive users receive the correct blocked experience, and reactivation
restores the existing relationships. A forwarded member or coach signup link
cannot grant elevated access, and two-facility RLS tests prove only a facility
admin can approve or change coach/admin roles in that facility.

---

## 5. Facility Configuration And Multi-Facility UI

- **Status:** Planned
- **Suggested branch:** `<name>/facility-configuration`
- **Plan detail:** [Facility and module configuration](VERSION_2_PLAN.md#v2-modifications-needed) · [Facility time and date rules](VERSION_2_PLAN.md#facility-time-and-date-rules) · [Branding and UI](VERSION_2_PLAN.md#brandingui)

This package turns the visible app into a real configurable platform. It
includes facility display name, branding, terminology, enabled modules, member
types, authoritative time zone, facility-local date helpers, and removal of
hardcoded Rip City/H2K assumptions. It also includes the cleaner H2K date-picker
behavior because that depends on facility-local dates.

**Complete when:** Rip City and Test Facility Alpha show their own correct
configuration, modules, and dates without leaking branding or facility-specific
features into each other.

---

## 6. Workout Builder, Exercise Library, And Member Logging

- **Status:** Complete
- **Branch:** `derek/workout-builder-refactor`
- **Plan detail:** [Universal and facility exercise library](VERSION_2_PLAN.md#universal-and-facility-exercise-library) · [Beta workout polish](VERSION_2_PLAN.md#8-beta-feedback-polish-queue)
- **Input audit:** [Starter exercise classifications](EXERCISE_INPUT_AUDIT.md)

This package stabilizes the daily coach-to-member workout experience. It
includes a modular and clearer coach builder, draggable block/exercise ordering,
a compact workout outline, safer save cleanup, assignment improvements, a
standalone facility-scoped exercise-library page, custom-exercise library sync,
workout detail/history management, the block-based member preview and logging
flow, responsive desktop/mobile polish, and the reviewed starter-exercise input
audit. Unilateral exercises support an `Each Side` prescription while members
continue entering one weight/reps result per set.

**Completed:** The refactored builder and exercise library, approved exercise
defaults, unilateral workflow, workout history controls, and responsive member
preview/logging experience were tested successfully in the pull-request preview.
The completed status enters `v2-development` with this branch. The larger
universal-catalog and historical-versioning data model is intentionally tracked
as Package 10 rather than being incorrectly counted as implemented here.

---

## 7. Leaderboards

- **Status:** In progress
- **Branch:** `derek/coach-leaderboards`
- **Plan detail:** [Leaderboards](VERSION_2_PLAN.md#3-leaderboards)

This package finalizes the first V2 metrics and builds the initial leaderboard
experience. The current branch adds separate facility-scoped coach H2K and
athlete boards, group filtering, search, tied competition ranks, rolling
four-week metrics, selectable ranking metrics, and shared personal
member-dashboard metrics. H2K streaks
require at least four habits per day; athlete attendance counts only workouts
actually assigned to that athlete. The package also simplifies the coach
dashboard into a coach-approved needs-attention queue and moves 12-week history
onto each member's detail page.

Member-facing top-five leaderboard pages remain a follow-up after Sam's member
page split is merged. The shared calculation layer created here must be reused
there so member and coach numbers cannot drift.

**Complete when:** The coach boards and personal member metrics pass staging
tests for both facilities, including ties, zero assignments, current-day streak
behavior, group filters, and workout-completion calculations.

---

## 8. Coach Communication

- **Status:** Planned
- **Suggested branch:** `<name>/coach-communication`
- **Plan detail:** [Coach announcements and notes](VERSION_2_PLAN.md#5-coach-announcements-and-notes) · [Notification direction](VERSION_2_PLAN.md#notification-direction)

This package covers the connected communication system: private facility-scoped
coach notes, targeted and expiring announcements, real coach sender identity,
member dismissal behavior, and the first in-app per-user notification/read-state
foundation.

**Complete when:** Notes remain private to authorized coaches/admins,
announcements reach only their intended facility audience, and members control
only their own dismissal and read state.

---

## 9. Testing Days, Progress, Profiles, And Controlled Community

- **Status:** Blocked on Rip City product decisions
- **Suggested branch:** `<name>/progress-community`
- **Plan detail:** [Progress tracking](VERSION_2_PLAN.md#4-progress-tracking) · [Profile and community](VERSION_2_PLAN.md#6-profile-and-community)

This package begins only after the remaining metric, write-permission, and
privacy decisions are made. It combines the first useful progress experience
with the profile surfaces that display approved goals, achievements, streaks,
and controlled community information. It also contains the proposed Testing
Day workflow: coaches define a testing session and ordered tests, select a
group/members, enter the roster's results efficiently, and connect approved
results to member progress and the existing leaderboard metric selector. The
Rip City coach discussion scheduled for 2026-10-18 determines whether the full
Testing Day workflow is required in V2 or becomes a V3 feature built on a V2
foundation.

**Complete when:** The first approved shared progress metrics, testing-result
rules, and private/public profile rules work consistently for both facilities
without prematurely pulling unapproved V3 baseball features into V2.

---

## 10. Workout Data Safety And Universal Catalog

- **Status:** Planned
- **Suggested branch:** `<name>/workout-data-safety`
- **Plan detail:** [Universal and facility exercise library](VERSION_2_PLAN.md#universal-and-facility-exercise-library) · [Workout editing and version history](VERSION_2_PLAN.md#workout-builder-editing-and-version-history)

This follow-up adds the database behavior that was designed but not implemented
by the builder refactor: a true universal catalog with facility overrides and
hides, safe editing/versioning for workouts with past or started assignments,
archive behavior for historical workouts, and the approved workout-completion
connection to H2K training habits. It also finalizes multi-coach assignment
behavior by displaying the assigning coach to members and coaches, preserving
historical attribution, adding database-safe duplicate prevention, and testing
two same-facility coaches plus a denied cross-facility coach. It must preserve
production history and add two-facility write/isolation tests.

**Complete when:** Universal exercise changes cannot leak between facilities,
coaches can correct future workouts without changing past assignments or logs,
historical workouts are archived instead of destructively deleted, and the
approved workout-to-habit automation is verified in staging. Multiple facility
coaches can safely assign workouts, every assignment shows who assigned it, and
concurrent duplicate assignments are prevented.

---

## 11. Stylesheet And UI Structure Cleanup

- **Status:** Planned
- **Suggested branch:** `<name>/stylesheet-cleanup`
- **Plan detail:** [Codebase cleanup and maintainability](VERSION_2_PLAN.md#9-codebase-cleanup-and-maintainability)

This package begins after the major V2 feature branches are merged. It splits
the large `css/styles.css` file into clearly ordered shared, component,
authentication, coach, and member stylesheets so future contributors can find
page styles quickly and parallel work creates fewer merge conflicts. The first
pass is a mechanical reorganization with no intentional visual redesign.

**Complete when:** Every active page loads the correct new stylesheets, the
original cascade and appearance are preserved, desktop/mobile visual regression
checks pass, and the old combined stylesheet can be removed safely.

---

## 12. Final V2 Release Hardening

- **Status:** Planned
- **Suggested branch:** `<name>/v2-release-hardening`
- **Plan detail:** [Version boundary](VERSION_2_PLAN.md#version-boundary) · [Release rule](VERSION_2_PLAN.md#release-rule) · [V2 regression and release checklist](VERSION_2_PLAN.md#v2-regression-and-release-checklist)

This final package is for integration fixes, security and accessibility gaps,
mobile/desktop regression results, migration rehearsal, recovery verification,
and production release preparation. It should not become a place for adding new
unplanned features.

**Complete when:** The agreed V2 scope passes the full staging checklist, both
contributors approve the release, and the production migration/deployment and
rollback steps are documented and rehearsed.

---

## Known Fixes Already Included Above

- Hardcoded Rip City branding → Package 5.
- Pending message shown to inactive accounts → Package 4.
- No multi-facility selector → Package 4.
- `platform_owner` cannot currently be stored → Package 4.
- Goals RLS does not support member-created goals → Package 3.
- Facility modules, terminology, and time zones are not data-driven → Package 5.
- Universal exercise overrides/hides are not implemented → Package 10.
- Workout archive/version rules remain incomplete → Package 10.
- Group archive/delete rules remain incomplete → Package 4.
- Announcements and per-user notifications have no V2 tables → Package 8.
- Current automated staging checks are read-only → each schema-changing package
  adds its own allowed and denied create/update/delete tests.
- No shared staging web preview or tested recovery procedure → Package 2.

If a new requirement or bug is discovered, place it inside the related package.
Create a separate package only when it represents a substantial independent
branch of work rather than a small fix.
