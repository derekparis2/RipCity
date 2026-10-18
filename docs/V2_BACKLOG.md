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

- **Status:** Complete
- **Branch:** `derek/facility-access`
- **Plan detail:** [Roles and permissions](VERSION_2_PLAN.md#v2-roles-and-permissions-foundation) · [Lifecycle rules](VERSION_2_PLAN.md#lifecycle-rules) · [Platform done criteria](VERSION_2_PLAN.md#done-criteria)

This package finishes the V2 single-facility account lifecycle. It includes
secure coach onboarding, correct pending/rejected/inactive experiences, and
safe deactivate/reactivate behavior that preserves each account's existing
membership and historical relationships.

**Current slice:** Secure coach onboarding is implemented and passed all 12
staging RLS checks on 2026-10-16: facility admins create seven-day, single-use
coach links; claims create pending coach memberships; and only an admin in the
invited facility can approve them. Reusable Athlete/H2K/general member links
remain unchanged for group emails. The complete staging browser flow was also
verified on 2026-10-16.

**Current lifecycle slice:** The blocked-account page now distinguishes pending,
rejected, inactive, and unconnected accounts. Facility admins can deactivate or
reactivate coaches from the approval page; ordinary coaches cannot change coach
access. Member and coach reactivation update the existing membership row rather
than creating a replacement.

All 20 account-lifecycle staging checks passed on 2026-10-16. They verified
pending/rejected/inactive blocking, admin-only coach lifecycle management, and
same-row restoration of member profiles, group relationships, and facility
access. Every temporarily changed fake-account status was restored afterward.

Future platform operations are tracked in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md). The second staging facility and its
dedicated accounts remain tenant-isolation fixtures; multi-facility identities
are not part of the V2 test shape or UI.

**Completed:** Pending, rejected, and inactive accounts receive the correct
blocked experience; only facility admins can deactivate/reactivate coaches;
ordinary member lifecycle rules remain enforced; reactivation restores access
through the same membership and relationships; and the lifecycle staging checks
pass. These conditions were verified on `derek/facility-access` and merged into
`v2-development`.

---

## Package 5 Moved To V3

The former **Facility Configuration And Module Visibility** package is no
longer part of V2. Self-service facility settings, configurable branding and
terminology, module switches, generalized facility-local time handling, and
onboarding additional real facilities are tracked in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md#facility-configuration-and-module-visibility).

V2 retains only the safeguards required for the Rip City release: strict
facility data isolation, H2K visibility based on member type, and correct Rip
City behavior using `America/New_York`. Package number 5 is intentionally
retired so existing package and pull-request references do not change.

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

## 7. Coach Leaderboards And Personal Metrics

- **Status:** Complete
- **Branch:** `derek/coach-leaderboards`
- **Plan detail:** [Leaderboards](VERSION_2_PLAN.md#3-leaderboards)

This package finalizes the first V2 metrics and coach leaderboard experience.
The branch adds separate facility-scoped coach H2K and
athlete boards, group filtering, search, tied competition ranks, rolling
four-week metrics, selectable ranking metrics, and shared personal
member-dashboard metrics. H2K streaks require at least four habits per day;
athlete attendance counts only workouts
actually assigned to that athlete. The package also simplifies the coach
dashboard into a coach-approved needs-attention queue and moves 12-week history
onto each member's detail page.

**Completed:** The coach boards, personal member metrics, attention queue,
member-detail history, repeatable ten-member leaderboard fixture, and shared
metric calculation layer are implemented. The leaderboard and attention-rule
test suites pass, and the seeded ties, streaks, attendance, zero-score states,
filters, and responsive preview were reviewed with fake staging data.

Member-facing top-five leaderboard pages are intentionally separated into the
next package so this completed branch can merge without depending on the member
page split.

---

## 7A. Member Page Split And Goals Polish

- **Status:** Complete
- **Branch:** `derek/member-page-split`
- **Plan detail:** [Goals](VERSION_2_PLAN.md#2-goals) · [Member mobile dashboard](VERSION_2_PLAN.md#member-mobile-dashboard)

This frontend-only package turns the overloaded member dashboard into a focused
home screen and dedicated Training, Habits, History, Goals, and Profile pages.
It keeps H2K-only navigation hidden from athletes, uses one consistent member
navigation map, preserves the existing facility-scoped feature behavior, and
gives the Goals workflow a clearer create/edit and active-progress layout.

**Completed:** Every member tab now opens its own focused page, H2K-only habits
remain hidden from athletes, and the shared navigation stays consistent across
dashboard, profile, and workout views. The Goals page includes collapsed goal
cards, a separate collapsed paused section, completed-goal history with recorded
completion dates, clearer start/current/finish values, and a compact create/edit
flow. The temporary Google feedback form is limited to compact member and coach
dashboard panels. Existing member actions and responsive phone/desktop behavior
were verified on the pull-request preview.

---

## 7B. Member-Facing Leaderboards

- **Status:** Planned
- **Suggested branch:** `<name>/member-leaderboards`
- **Plan detail:** [Leaderboards](VERSION_2_PLAN.md#3-leaderboards)

This package adds the member leaderboard page using the shared calculations
from Package 7. It shows only the member's relevant H2K or athlete board, the
approved facility/group top five, tied competition ranks, profile identity,
and the member's own rank or "No score yet" state. It must not expose the full
coach list, the other member type, or unapproved metrics.

**Complete when:** H2K and athlete members see only their approved top-five and
own-rank views, calculations match the coach boards, both facilities remain
isolated, and phone/desktop staging checks pass.

---

## 8. Targeted Coach Announcements

- **Status:** In progress
- **Branch:** `derek/targeted-announcements`
- **Plan detail:** [Coach announcements and notes](VERSION_2_PLAN.md#5-coach-announcements-and-notes) · [Notification direction](VERSION_2_PLAN.md#notification-direction)

The V2 communication slice lets coaches/admins publish announcements to their
full facility, one or more groups, or one or more individual members. Members
see only announcements that target them, with the real sender and publish date
shown on the member dashboard. Facility-scoped RLS and two-facility tests are
required. Announcements default to a one-day expiration that coaches can change
or remove, support Standard and Important ordering, and keep expired messages
out of member access. Creators can clear their own expired messages and facility
admins can clear all expired facility announcements.

Private coach-note UI, a generalized notification center, delivery channels,
and richer read/dismissal behavior are deferred to V3. The existing private
`coach_notes` table remains protected and is not removed.

**Complete when:** Coaches can create and manage facility/group/member
announcements, members see only their targeted announcements, sender identity
is accurate, and allowed/denied targeting tests pass in both staging facilities.

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

## 10. Workout Data Safety And Assignment Attribution

- **Status:** Planned
- **Suggested branch:** `<name>/workout-data-safety`
- **Plan detail:** [Workout editing and version history](VERSION_2_PLAN.md#workout-builder-editing-and-version-history)

This follow-up adds the database behavior that was designed but not implemented
by the builder refactor: safe editing/versioning for workouts with past or started assignments,
archive behavior for historical workouts, and the approved workout-completion
connection to H2K training habits. It also finalizes multi-coach assignment
behavior by displaying the assigning coach to members and coaches, preserving
historical attribution, adding database-safe duplicate prevention, and testing
two same-facility coaches plus a denied other-facility coach. It must preserve
production history and add two-facility write/isolation tests.

The true multi-facility universal catalog with facility overrides/hides is V3
scope. V2 keeps the current Rip City exercise library behavior.

**Complete when:** Coaches can correct future workouts without changing past assignments or logs,
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

## Known Fixes And Scope Placement

- Configurable facility branding → V3 facility configuration.
- Pending message shown to inactive accounts → Package 4.
- Future multi-facility and baseball-development work →
  [`VERSION_3_PLAN.md`](VERSION_3_PLAN.md).
- Goals RLS does not support member-created goals → Package 3.
- Data-driven modules, terminology, branding, and generalized facility time
  zones → V3 facility configuration.
- Universal exercise overrides/hides are not implemented → V3 facility
  configuration.
- Workout archive/version rules remain incomplete → Package 10.
- Group archive/delete rules remain incomplete → final release scope review or
  V3 facility operations.
- Targeted announcements have no V2 tables → Package 8; the generalized
  notification system is V3.
- Current automated staging checks are read-only → each schema-changing package
  adds its own allowed and denied create/update/delete tests.
- No shared staging web preview or tested recovery procedure → Package 2.

If a new requirement or bug is discovered, place it inside the related package.
Create a separate package only when it represents a substantial independent
branch of work rather than a small fix.
