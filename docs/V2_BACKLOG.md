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

The original 20 account-lifecycle checks passed on 2026-10-16. The expanded
25-check suite passed on 2026-10-23 after admin-only member lifecycle
enforcement was applied. It also proves ordinary coaches cannot approve or
deactivate members. Every temporarily changed fake-account status was restored.

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

**Admin-only permissions hardening:** Complete on
`derek/admin-member-lifecycle`. Coaches can still view members, but only
facility admins can approve, reject, deactivate, or reactivate accounts. Group
creators are now recorded so coaches can delete groups or remove existing
members only from groups they created, while admins retain full group control.
The 25 account-lifecycle checks and 15 group-ownership checks passed in staging
on 2026-10-23, with all temporary fixture changes cleaned up.

**Signup-group approval hardening:** Complete on
`derek/admin-assigned-signup-groups`. Athlete and H2K signup no longer expose a
group selector. Facility admins select the initial matching group during
approval, and a transactional database operation prevents self-assignment,
wrong-program or cross-facility assignment, and approval without a valid group.
All 19 expanded athlete/H2K checks passed on 2026-10-24, with both fixture
accounts restored and both temporary groups removed. This slice is ready for
production migration and merge.

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
The branch adds separate facility-scoped coach H2K and athlete boards, group
filtering, search, tied competition ranks, rolling four-week habit metrics,
selectable ranking metrics, and shared personal member-dashboard metrics. Both
programs use the same habit-score and four-habits-per-day streak rules, while
assigned-workout completion remains in the workout review. The package also simplifies the coach
dashboard into a coach-approved needs-attention queue and moves 12-week history
onto each member's detail page.

**Completed:** The coach boards, personal member habit metrics, attention queue,
member-detail history, repeatable ten-member leaderboard fixture, and shared
metric calculation layer are implemented. The leaderboard and attention-rule
test suites pass, and the seeded ties, habit streaks, attendance-review, zero-score states,
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
It uses one consistent member navigation map, preserves the existing
facility-scoped feature behavior, and
gives the Goals workflow a clearer create/edit and active-progress layout.

**Completed:** Every member tab now opens its own focused page and the shared
navigation stays consistent across
dashboard, profile, and workout views. The Goals page includes collapsed goal
cards, a separate collapsed paused section, completed-goal history with recorded
completion dates, clearer start/current/finish values, and a compact create/edit
flow. The temporary Google feedback form is limited to compact member and coach
dashboard panels. Existing member actions and responsive phone/desktop behavior
were verified on the pull-request preview.

---

## 7B. Member-Facing Leaderboards

- **Status:** Planned post-launch
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

## 7C. Shared UI Polish And Coach Mobile Navigation

- **Status:** Complete
- **Branch:** `derek/ui-polish`
- **Plan detail:** [Responsive UI standard](VERSION_2_PLAN.md#responsive-ui-standard) · [Beta feedback polish queue](VERSION_2_PLAN.md#8-beta-feedback-polish-queue)

This frontend-only package makes the current V2 features easier to use without
changing their permissions or database behavior. It gives every coach/admin
page one shared destination map and compact mobile menu; moves the Athlete and
H2K signup actions to Roster; makes pending approvals the primary approvals
workflow; progressively renders long roster and exercise-library lists; and
reduces tall forms and secondary controls through purposeful disclosure.

The member side gains a shared habit-history experience, a five-day streak
flame with stronger heat at longer streaks, a compact profile editor, and
consistent stylesheet delivery across active pages. Coach profile editing and
announcement sender-profile behavior remain separate account/profile work.

**Completed:** Coach destinations are consistent across coach/admin pages, the
Roster and Approvals workflows use focused progressive disclosure, long lists
are easier to use, workout review is workout-first, member history copy is
member-type appropriate, and the responsive phone/desktop pass was merged into
`v2-development`.

---

## 8. Targeted Coach Announcements

- **Status:** Complete
- **Branch:** `derek/targeted-announcements`
- **Plan detail:** [Coach announcements and notes](VERSION_2_PLAN.md#5-coach-announcements-and-notes) · [Notification direction](VERSION_2_PLAN.md#notification-direction)

The V2 communication slice lets coaches/admins publish announcements to their
full facility, one or more groups, or one or more individual members. Members
see only announcements that target them, with the real sender and publish date
shown on the member dashboard. Facility-scoped RLS and two-facility tests are
required. Announcements default to a one-day expiration that coaches can change
or remove, support Standard and Important ordering, and keep expired messages
out of member access. Creators can clear their own expired messages and facility
admins can clear all expired facility announcements. The coach composer is
collapsed by default, and broad All Athletes and All H2K audiences reach each
matching member once regardless of group overlap. Custom targeting uses a
compact searchable Groups/Members picker with retained selections and counts.
Members see one compact message first and can dismiss a message for the current
day. Dismissed messages remain available in a collapsed section at the bottom
of the dashboard and can be restored immediately or later that day.

Private coach-note UI, a generalized notification center, delivery channels,
and richer read/dismissal behavior are deferred to V3. The existing private
`coach_notes` table remains protected and is not removed.

**Completed:** Coaches and facility admins can create and manage facility,
All Athletes, All H2K, multi-group, and individual-member announcements without
duplicating a message for members who belong to overlapping groups. Sender
identity, importance, one-day default expiration, optional custom expiration,
expired-message cleanup, compact member display, same-day dismissal, and
restoration are implemented. The collapsed coach composer and searchable
recipient picker were verified on phone and desktop, and all 26 expanded
two-facility staging RLS checks passed on 2026-10-18. This package was merged
into `v2-development`.

---

## 9. Testing Days, Progress, Profiles, And Controlled Community

- **Status:** Planned post-launch
- **Suggested branch:** `<name>/progress-community`
- **Plan detail:** [Progress tracking](VERSION_2_PLAN.md#4-progress-tracking) · [Profile and community](VERSION_2_PLAN.md#6-profile-and-community)

This package begins only after the remaining metric, write-permission, and
privacy decisions are made. It combines the first useful progress experience
with the profile surfaces that display approved goals, achievements, streaks,
and controlled community information. It also contains the proposed Testing
Day workflow: coaches define a testing session and ordered tests, select a
group/members, enter the roster's results efficiently, and connect approved
results to member progress and the existing leaderboard metric selector. The
Rip City approved Testing Days as the next major product feature, but the work
is intentionally scheduled after the current V2 production release so release
preparation does not mix with a new schema and workflow.

**Complete when:** The first approved shared progress metrics, testing-result
rules, and private/public profile rules work consistently for both facilities
without prematurely pulling unapproved V3 baseball features into V2.

---

## 10A. Shared Member Habits And Assignment Attribution

- **Status:** Complete
- **Branch:** `derek/athlete-habits`
- **Plan detail:** [Member mobile dashboard](VERSION_2_PLAN.md#member-mobile-dashboard) · [Multi-coach workout assignment](VERSION_2_PLAN.md#multi-coach-workout-assignment)

This release-blocking package gives Rip City athletes the same daily habit
tracking, weekly score, rolling history, and Habits navigation as H2K members.
It also makes shared staff ownership visible: every coach can use authorized
facility workouts, while member workout cards/sessions and coach history/review
show who created the workout and who assigned it. A narrow database function
returns display names only for assignments the signed-in user is already
authorized to read, without exposing coach email or profile records to members.

**Completed:** Rip City athletes and H2K members share habit navigation,
logging, weekly scores, coach/member history, and identical habit leaderboard
metrics in separate program tabs. Members and coaches see the workout creator
and assigning coach without exposing broader coach-profile data. The focused
local tests and two-facility staging test passed on 2026-10-23. The shared
leaderboard fixture was also refreshed successfully with 1,464 habit logs, 50
assignments, and 38 completed assignments. The package was merged into
`v2-development` on 2026-10-23.

---

## 10B. Workout Versioning, Archive, And Duplicate Hardening

- **Status:** Planned post-launch hardening
- **Suggested branch:** `<name>/workout-data-safety`
- **Plan detail:** [Workout editing and version history](VERSION_2_PLAN.md#workout-builder-editing-and-version-history)

This follow-up owns safe editing/versioning for workouts with past or started
assignments, archive behavior for historical workouts, the approved
workout-completion connection to daily habits, and database-safe duplicate
prevention. Assignment creator/assigner visibility is completed in Package 10A.
This package must preserve production history and add two-facility write and
isolation tests.

The member UI already collapses duplicate assignment rows by workout and date,
but the database can still store overlapping group/facility/member assignments.
The final implementation must resolve those overlaps to one effective member
assignment so the workout appears once, is counted once in attendance and
leaderboards, and has one unambiguous set-log history even when a member belongs
to multiple selected groups.

The true multi-facility universal catalog with facility overrides/hides is V3
scope. V2 keeps the current Rip City exercise library behavior.

**Complete when:** Coaches can correct future workouts without changing past assignments or logs,
historical workouts are archived instead of destructively deleted, and the
approved workout-to-habit automation is verified in staging, while
overlapping-target or concurrent duplicate assignments cannot produce multiple
effective workouts for the same member and date.

---

## 11. Stylesheet And UI Structure Cleanup

- **Status:** Planned post-launch
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

- **Status:** In progress
- **Branch:** `derek/v2-release-hardening`
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
- Distinct pending, rejected, inactive, and unconnected experiences were
  completed in Package 4.
- Future multi-facility and baseball-development work →
  [`VERSION_3_PLAN.md`](VERSION_3_PLAN.md).
- Member-created and coach-created goals were completed in Package 3.
- Data-driven modules, terminology, branding, and generalized facility time
  zones → V3 facility configuration.
- Universal exercise overrides/hides are not implemented → V3 facility
  configuration.
- Workout archive/version and database duplicate rules remain incomplete →
  Package 10B; they are post-launch hardening, not part of the final pre-main
  feature branch.
- Group archive/delete rules remain incomplete → final release scope review or
  V3 facility operations.
- Targeted announcements and their facility-scoped RLS were completed in
  Package 8; the generalized notification system remains V3.
- Schema-changing packages include focused allowed/denied write tests in
  addition to the baseline read-only isolation suite.
- Shared Netlify staging previews and the repository-based Supabase rebuild
  procedure were completed in Package 2.

If a new requirement or bug is discovered, place it inside the related package.
Create a separate package only when it represents a substantial independent
branch of work rather than a small fix.
