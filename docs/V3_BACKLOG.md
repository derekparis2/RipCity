# Version 3 Work Backlog

This is the ordered branch queue for V3. Detailed product rules live in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md). Derek or Sam may pick a **Ready**
package, create a named feature branch from the latest `v3-development`, and
open a pull request back into `v3-development` after the first commit.

Do not create every branch in advance. Before starting a schema-changing
package, confirm that the other contributor is not applying a different
migration to the shared staging project.

## Immediate Release Gate

**Package 1 is the only implementation priority until it is complete.** Finish
the complete strength-max and percentage-programming workflow, verify it in
staging, merge its reviewed feature branch into `v3-development`, and then
release `v3-development` to `main`. Only after that production merge should
Derek and Sam continue with Packages 2 and later.

Planning and approved sample-data research may happen while Package 1 is in
progress, but later feature implementation must not delay or expand the first
workout release.

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

- **Status:** In progress on `derek/testing-comparisons`; merge after Package 1 is live on `main`
- **Suggested branch:** `<name>/testing-progress`
- **Plan detail:** [Advanced testing](VERSION_3_PLAN.md#advanced-testing-and-performance-history)

Extend the shipped Testing Day feature with approved attempt/best-result rules,
comparison history, improvement values, personal records, charts, correction
audit, and selected leaderboard metrics. Reuse the shared metric contract
rather than creating a second incompatible statistics system.

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
Performance view.

Remaining Package 3 work includes approved multiple-attempt rules, correction
audit history, roster-wide comparison tools, and explicitly approved testing
leaderboard metrics.

**Complete when:** Members and coaches can clearly compare current and prior
results, approved tests show historically correct improvements and records,
corrections remain auditable, and only explicitly approved metrics enter
leaderboards.

---

## 4. Platform Ownership And Isolation Contract

- **Status:** Ready
- **Suggested branch:** `<name>/platform-owner-isolation`
- **Plan detail:** [Platform owners](VERSION_3_PLAN.md#platform-owners) · [Required safety rules](VERSION_3_PLAN.md#5-required-safety-rules)

Add the stored platform-owner authorization for Derek and Sam, trusted
facility-creation functions, explicit support-access boundaries, audit events,
and the RLS test matrix that prevents platform tooling from becoming an
automatic private-data bypass. Facility staff remain limited to their own
facility.

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
safe archive/recovery behavior. Remove the hardcoded Rip City/H2K assumptions
that block a real second-facility launch.

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
