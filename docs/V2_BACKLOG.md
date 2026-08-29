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
45 automated read-only RLS checks are documented and verified. The completed
package will enter `v2-development` when this pull request is approved and
squash-merged.

---

## 2. Staging Preview And Release Safety

- **Status:** Ready
- **Suggested branch:** `<name>/staging-release-safety`
- **Plan detail:** [Staging and release safety](VERSION_2_PLAN.md#7-staging-and-release-safety) · [Regression and release checklist](VERSION_2_PLAN.md#v2-regression-and-release-checklist) · [Accessibility standard](VERSION_2_PLAN.md#accessibility-standard)

This package makes the staging environment usable and repeatable for both
contributors. It includes the shared non-production web preview, staging-only
Supabase/Auth configuration, the regression and accessibility checklist,
migration verification, manual backup/recovery instructions, rollback guidance,
and post-deploy smoke tests.

**Complete when:** Both contributors can open the staging preview, test it with
fake accounts, and follow one documented checklist without touching production.

---

## 3. Goals And Coach Member Detail

- **Status:** Ready
- **Suggested branch:** `<name>/goals-v2`
- **Plan detail:** [Goals](VERSION_2_PLAN.md#2-goals) · [Coach member-detail requirements](VERSION_2_PLAN.md#first-ui-version)

This is one complete Goals feature rather than separate tiny database and UI
branches. It includes the approved goal fields, member-created and coach-created
goals, creator-specific edit/delete rules, status and completion history,
confirmations, the coach member-detail foundation needed to manage goals, RLS,
and two-facility create/read/update/delete tests.

**Complete when:** Members and coaches can safely complete every approved Goals
workflow in staging and direct RLS tests prove cross-facility access is denied.

---

## 4. Facility Access And Account Lifecycle

- **Status:** Planned
- **Suggested branch:** `<name>/facility-access`
- **Plan detail:** [Roles and permissions](VERSION_2_PLAN.md#v2-roles-and-permissions-foundation) · [Lifecycle rules](VERSION_2_PLAN.md#lifecycle-rules) · [Platform done criteria](VERSION_2_PLAN.md#done-criteria)

This package makes multi-facility access intentional. It includes the storable
Derek-only platform-owner role, safe facility administration, an active-facility
selector for legitimate multi-facility accounts, correct pending/rejected/
inactive experiences, and deactivate/reactivate behavior that restores history.

**Complete when:** Every account operates only inside its selected authorized
facility, inactive users receive the correct blocked experience, and reactivation
restores the existing relationships.

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

## 6. Exercise Library And Workout V2 Finalization

- **Status:** Planned
- **Suggested branch:** `<name>/workouts-v2`
- **Plan detail:** [Universal and facility exercise library](VERSION_2_PLAN.md#universal-and-facility-exercise-library) · [Beta workout polish](VERSION_2_PLAN.md#8-beta-feedback-polish-queue)

This package completes the workout foundation that V2 is meant to stabilize. It
includes one combined exercise library, facility-only exercises, universal
edit-to-override and delete-to-hide behavior, stable workout history, workout
editing and assignment cleanup, archive/delete rules, member history, mobile
session polish, and workout-derived H2K behavior.

**Complete when:** The full coach-to-member workout lifecycle is stable on
desktop and mobile, and exercise changes cannot leak across facilities or alter
historical workouts.

---

## 7. Leaderboards

- **Status:** Planned
- **Suggested branch:** `<name>/leaderboards-v2`
- **Plan detail:** [Leaderboards](VERSION_2_PLAN.md#3-leaderboards)

This package finalizes the first V2 metrics and builds the complete initial
leaderboard experience: coach facility/group filters, separated H2K and athlete
boards, member top five plus own rank, tied ranks, profile identity, approved
time ranges, and facility-time-zone calculations.

**Complete when:** Coaches and members see only the approved metrics, people,
member types, and time periods for their own facility.

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

## 9. Progress, Profiles, And Controlled Community

- **Status:** Blocked on product decisions
- **Suggested branch:** `<name>/progress-community`
- **Plan detail:** [Progress tracking](VERSION_2_PLAN.md#4-progress-tracking) · [Profile and community](VERSION_2_PLAN.md#6-profile-and-community)

This package begins only after the remaining metric, write-permission, and
privacy decisions are made. It combines the first useful progress experience
with the profile surfaces that display approved goals, achievements, streaks,
and controlled community information.

**Complete when:** The first approved shared progress metrics and private/public
profile rules work consistently for both facilities without pulling V3 baseball
features into V2.

---

## 10. Final V2 Release Hardening

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
- Universal exercise overrides/hides are not implemented → Package 6.
- Workout and group archive/delete rules remain incomplete → Packages 4 and 6.
- Announcements and per-user notifications have no V2 tables → Package 8.
- Current automated staging checks are read-only → each schema-changing package
  adds its own allowed and denied create/update/delete tests.
- No shared staging web preview or tested recovery procedure → Package 2.

If a new requirement or bug is discovered, place it inside the related package.
Create a separate package only when it represents a substantial independent
branch of work rather than a small fix.
