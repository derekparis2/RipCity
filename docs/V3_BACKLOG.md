# Version 3 Work Backlog

This is the ordered branch queue for V3. Detailed product rules live in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md). Derek or Sam may pick a **Ready**
package, create a named feature branch from the latest `v3-development`, and
open a pull request back into `v3-development` after the first commit.

Do not create every branch in advance. Before starting a schema-changing
package, confirm that the other contributor is not applying a different
migration to the shared staging project.

## Immediate Release And Parallel-Work Rules

Package 1 remains the next production release gate: finish the complete
strength-max and percentage-programming workflow, verify it in staging, merge
its reviewed feature branch into `v3-development`, and release that package to
`main` without waiting for unrelated V3 work.

Independent packages may be developed and reviewed in parallel when they do
not overlap Package 1's workout/max schema or builder files. In particular,
Package 3 is complete on `v3-development`, and Packages 4-6 may proceed as the
next platform-sales track while Package 1 is finished. Do not let those
branches expand or delay the Package 1 production release; coordinate the
actual release order and rerun focused tests after merging shared changes.

## Status Key

- **Ready:** Product direction is sufficient to begin the branch.
- **Needs input:** Research, sample data, or a product decision is required
  before implementation.
- **Depends on:** Start after the named package establishes its foundation.
- **Later:** Valid V3 scope, but not an early package.

---

## 1. Strength Maxes And Percentage-Based Programming

- **Status:** **NEXT — highest-priority V3 release gate**
- **Suggested branch:** `<name>/strength-max-programming`
- **Plan detail:** [Strength maxes and percentage programming](VERSION_3_PLAN.md#strength-maxes-and-percentage-based-programming)

Add coach-managed verified, estimated, and training-max history. Let coaches
calculate an estimated max from weight and reps, review the source and formula,
and prescribe workout loads as percentages without rebuilding the workout
builder. Complete this workout-side value package before starting the hitting
implementation packages.

**Complete when:** Coaches can record verified, estimated, and training-max
history; prescribe a percentage in the existing workout builder; review each
member's resolved load before assignment; and members see the correct resolved
target. Missing maxes cannot silently become zero-weight prescriptions,
rounding follows facility rules, Testing Day strength results can be approved
into max history, and every assignment preserves the exact max and calculated
load used at that time. The migration, RLS checks, focused automated tests,
responsive staging checks, and production release notes must all be complete.

**Release action:** When every completion item above passes review, merge this
package through `v3-development` into `main`. Confirm the production migration
and smoke test, then continue to Package 2.

---

## 2. Daily Routines And Checklists

- **Status:** Ready after Package 1 is live on `main`
- **Suggested branch:** `<name>/daily-routines`
- **Plan detail:** [Daily routines and checklists](VERSION_3_PLAN.md#daily-routines-and-checklists)

Add facility-configured morning, afternoon, and night routines without
duplicating the existing habit engine. Coaches define reusable checklist
templates, assign them to groups or individuals, and review completion while
members get a simple time-of-day experience.

**Complete when:** Routine templates, assignments, member completion, history,
streak behavior, coach review, time-zone rules, and facility isolation work in
staging on phone and desktop.

---

## 3. Advanced Testing Comparisons And Performance History

- **Status:** **Complete on `v3-development`** (PR #26, 2026-11-08)
- **Suggested branch:** `<name>/testing-progress`
- **Plan detail:** [Advanced testing](VERSION_3_PLAN.md#advanced-testing-and-performance-history)

Extend the shipped Testing Day feature with comparison history, direction-aware
improvement values, personal records, and focused member/staff performance
views. Reuse the shared metric contract rather than creating a second
incompatible statistics system.

The first comparison slice is implemented without a schema change: members can
review their own numeric Testing Day history and coaches/admins can review the
same progress from an individual member page. It uses the earliest completed
official result as the baseline, the immediately previous official result as
the prior result, and the best official result as the PR. Improvement is
direction-aware, so a lower sprint time and a higher jump both display as
positive progress. `Not Tested`, absent, scheduled, text, and unranked outcomes
do not enter comparisons. Member Training now separates Schedule from
Performance: the calendar and upcoming Testing Days remain together, while
comparisons and searchable completed Testing Day history live in the focused
Performance view. Both member and coach performance lists stay compact as the
test catalog grows: tests start collapsed, only one opens at a time, search and
recent/name sorting are available, and results load six at a time.
The coach/admin member profile uses the same focused pattern: Overview keeps
member identity and weekly history together, Goals contains goal management,
and Performance contains Testing Day comparisons and official history.

Completed Testing Day review also shows each athlete's direction-aware change
from the immediately previous official result. The result itself remains
neutral while improvement/regression color applies only to the comparison.
First results correctly show no change label. Derek decided not to add a
"most improved" leaderboard in this package.

**Completed scope:** Members and coaches can compare baseline, previous,
latest, and personal-record results; completed-day staff review shows change
from prior; responsive lists remain searchable, collapsed, and paginated as
the test catalog grows; and only the member's authorized official results are
used. This package required no schema migration.

Approved multiple-attempt rules, deeper correction audit history, and any
future Testing Day leaderboard metrics remain optional extensions and require
separate product approval rather than keeping Package 3 open.

---

## 4. Platform Ownership And Isolation Contract

- **Status:** **In progress on `derek/facility-platform`**; safe to develop in
  parallel with Package 1
- **Suggested branch:** `derek/facility-platform`
- **Plan detail:** [Platform owners](VERSION_3_PLAN.md#platform-owners) · [Required safety rules](VERSION_3_PLAN.md#5-required-safety-rules)

Add the stored platform-owner authorization for Derek and Sam, trusted
facility-creation functions, explicit support-access boundaries, audit events,
and the RLS test matrix that prevents platform tooling from becoming an
automatic private-data bypass. Facility staff remain limited to their own
facility.

Foundation verified in staging on 2026-11-08:

- Platform ownership is stored privately and is not exposed through the public
  REST API.
- The dedicated Rip City and Alpha platform fixtures can list facilities and
  enter only the existing facility-admin experiences for which they have an
  approved membership.
- Platform ownership alone does not bypass cross-facility member RLS.
- Facility admins and ordinary coaches cannot invoke platform operations.
- Direct facility creation remains closed until the trusted provisioning
  workflow is implemented later in this package.
- The Step 2 configuration schema and owner-only replacement operation passed
  focused staging verification on 2026-11-08. They cover branding, IANA
  timezone, terminology, member programs, module switches, and facility
  lifecycle metadata without yet creating facilities.
- The shared frontend now loads the signed-in facility configuration, applies
  its name/logo/colors, removes disabled modules from coach/member navigation
  and dashboard entry points, and redirects direct visits to disabled feature
  pages. Member signup links carry the destination facility slug, use that
  facility's enabled programs and branding, and cannot attach an existing
  account to another facility.
- The remaining work in this package is the audited owner UI and trusted
  facility-provisioning operation; ordinary facility pages no longer need
  Rip City-specific configuration to choose modules or signup destinations.

**Complete when:** Only Derek and Sam can invoke platform facility operations;
facility admins and coaches cannot; normal facility access remains isolated;
and focused two-facility allowed/denied tests pass in staging.

---

## 5. Facility Creation And Configuration

- **Status:** Depends on Package 4
- **Suggested branch:** `<name>/facility-creation`
- **Plan detail:** [Facility creation and isolation](VERSION_3_PLAN.md#facility-creation-and-isolation) · [Facility configuration](VERSION_3_PLAN.md#facility-configuration-and-module-visibility)

Build the owner-only facility setup workflow, initial admin creation, branding,
time zone, terminology, member programs, module switches, starter groups, and
safe archive/recovery behavior. Existing workouts, habits, goals,
leaderboards, announcements, and Testing Days are shared platform modules, not
Rip City-only features. Facility setup configures which modules and labels a
facility uses rather than rebuilding those features for each customer.

**Complete when:** A new facility can be created from the application, its
first admin can sign in, disabled modules stay unavailable, and the complete
cross-facility test suite proves the new facility shares no private Rip City
data.

---

## 6. Second-Facility Launch Rehearsal

- **Status:** Depends on Package 5
- **Suggested branch:** `<name>/second-facility-rehearsal`
- **Plan detail:** [Facility creation and isolation](VERSION_3_PLAN.md#facility-creation-and-isolation) · [Facility time and date rules](VERSION_3_PLAN.md#facility-time-and-date-rules)

Use fake staging data to rehearse the exact launch checklist for a second real
facility: setup, branding, modules, admin onboarding, groups, signup, member
approval, workouts, goals, announcements, Testing Days, storage, time zone, and
recovery. Record every manual project setting or unsupported step.

**Complete when:** The repository and documented workflow can launch the fake
second facility without ad hoc SQL and every private-data isolation check
passes.

---

## 7. Hitting Data Discovery And Metric Contract

- **Status:** Starts after Package 1 is live; research needs approved sample data
- **Suggested branch:** `<name>/hitting-data-contract`
- **Plan detail:** [Hitting data foundation](VERSION_3_PLAN.md#hitting-data-foundation)

Collect approved fake/sample HitTrax and TrackMan exports, document available
API/export access and terms, map athlete identifiers and units, and define the
source-neutral hitting metric and import contract. This package should not
promise live vendor APIs before access is confirmed.

**Complete when:** The supported first metrics, source metadata, athlete-match
rules, duplicate/correction behavior, fake fixtures, and import acceptance
criteria are documented and approved for implementation.

---

## 8. Hitting Import And Verified Results

- **Status:** Depends on Package 7
- **Suggested branch:** `<name>/hitting-imports`
- **Plan detail:** [Hitting data foundation](VERSION_3_PLAN.md#hitting-data-foundation)

Implement the normalized hitting schema and the first approved manual/CSV or
API ingestion path. Include preview, athlete matching, unit validation,
duplicate handling, error reporting, verification, correction history, source
provenance, RLS, and two-facility tests.

**Complete when:** Staff can safely import an approved fake vendor file, review
it before saving, correct matching problems, and produce verified results that
cannot leak across facilities.

---

## 9. Hitting Development Experience

- **Status:** Depends on Package 8
- **Suggested branch:** `<name>/hitting-progress`
- **Plan detail:** [Hitting development experience](VERSION_3_PLAN.md#hitting-development-experience) · [Player development profile](VERSION_3_PLAN.md#player-development-profile)

Add coach and member views for hitting sessions, trends, personal bests,
approved comparisons, and clear source/verification labels. Connect approved
metrics to the shared progress registry without exposing private facility data.

**Complete when:** Coaches can review a player's hitting development over time,
members see only their approved own results, and responsive plus RLS checks
pass.

---

## 10. Player Development Profiles And Evaluations

- **Status:** Needs visibility decisions
- **Suggested branch:** `<name>/player-development-profiles`
- **Plan detail:** [Player development profile](VERSION_3_PLAN.md#player-development-profile) · [Coach evaluations](VERSION_3_PLAN.md#coach-evaluations)

Add the baseball development card and versioned coach evaluations after
private, coach-visible, athlete-visible, and shareable fields are approved.

**Complete when:** Baseball data remains optional, evaluations preserve
history, every field follows its approved audience rule, and non-baseball
facilities do not receive irrelevant UI.

---

## 11. Throwing And Arm Care

- **Status:** Later; hitting comes first and privacy review is required
- **Suggested branch:** `<name>/throwing-arm-care`
- **Plan detail:** [Throwing and arm care](VERSION_3_PLAN.md#throwing-and-arm-care)

Add throwing and arm-care programming only after the medical/injury privacy,
consent, retention, disclaimer, and visibility decisions are documented.

**Complete when:** Approved programs and tracking work without duplicating the
workout engine, and sensitive information has explicit access and retention
controls.

---

## 12. Notifications, Private Notes, And Audit History

- **Status:** Later
- **Suggested branch:** `<name>/notifications-notes-audit`
- **Plan detail:** [Shared V3 extensions](VERSION_3_PLAN.md#4-shared-v3-extensions)

Build the private coach-note UI, generalized in-app notification/read state,
and audit history for sensitive owner, facility, import, evaluation, and result
actions. Email and push remain follow-ups.

---

## 13. Recruiting And Shareable Profiles

- **Status:** Later; requires explicit privacy and authorization rules
- **Suggested branch:** `<name>/recruiting-profiles`
- **Plan detail:** [Recruiting and showcase information](VERSION_3_PLAN.md#recruiting-and-showcase-information)

Keep internal development records separate from deliberately published player
information. No public link is created until audience, consent, expiration, and
revocation rules are approved.

---

## Independent Maintenance Package

### Stylesheet Organization

- **Status:** Ready only when it will not conflict with active UI branches
- **Suggested branch:** `<name>/stylesheet-organization`
- **Plan detail:** [Shared V3 extensions](VERSION_3_PLAN.md#4-shared-v3-extensions)

Mechanically split the large stylesheet into ordered shared, component,
authentication, coach, and member files with no intended visual changes. This
is not workout/exercise hardening and should remain separate from feature work.

**Complete when:** Every page loads the correct styles in the original cascade
order and mobile/desktop visual regression checks pass.
