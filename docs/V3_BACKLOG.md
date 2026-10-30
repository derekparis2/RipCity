# Version 3 Work Backlog

This is the ordered branch queue for V3. Detailed product rules live in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md). Derek or Sam may pick a **Ready**
package, create a named feature branch from the latest `v3-development`, and
open a pull request back into `v3-development` after the first commit.

Do not create every branch in advance. Before starting a schema-changing
package, confirm that the other contributor is not applying a different
migration to the shared staging project.

## Status Key

- **Ready:** Product direction is sufficient to begin the branch.
- **Needs input:** Research, sample data, or a product decision is required
  before implementation.
- **Depends on:** Start after the named package establishes its foundation.
- **Later:** Valid V3 scope, but not an early package.

---

## 1. Strength Maxes And Percentage-Based Programming

- **Status:** Highest-priority V3 product package; needs max-formula decisions
- **Suggested branch:** `<name>/strength-max-programming`
- **Plan detail:** [Strength maxes and percentage programming](VERSION_3_PLAN.md#strength-maxes-and-percentage-based-programming)

Add coach-managed verified, estimated, and training-max history. Let coaches
calculate an estimated max from weight and reps, review the source and formula,
and prescribe workout loads as percentages without rebuilding the workout
builder. Complete this workout-side value package before starting the hitting
implementation packages.

**Complete when:** Coaches can safely review each member's resolved load before
assignment, missing maxes cannot silently become zero-weight prescriptions,
rounding follows facility rules, and every assigned percentage target preserves
the exact max and calculated load used at that time.

---

## 2. Platform Ownership And Isolation Contract

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

## 3. Facility Creation And Configuration

- **Status:** Depends on Package 2
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

## 4. Second-Facility Launch Rehearsal

- **Status:** Depends on Package 3
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

## 5. Hitting Data Discovery And Metric Contract

- **Status:** Starts after Package 1; research also needs sample data
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

## 6. Hitting Import And Verified Results

- **Status:** Depends on Package 5
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

## 7. Hitting Development Experience

- **Status:** Depends on Package 6
- **Suggested branch:** `<name>/hitting-progress`
- **Plan detail:** [Hitting development experience](VERSION_3_PLAN.md#hitting-development-experience) · [Player development profile](VERSION_3_PLAN.md#player-development-profile)

Add coach and member views for hitting sessions, trends, personal bests,
approved comparisons, and clear source/verification labels. Connect approved
metrics to the shared progress registry without exposing private facility data.

**Complete when:** Coaches can review a player's hitting development over time,
members see only their approved own results, and responsive plus RLS checks
pass.

---

## 8. Advanced Testing And Performance Trends

- **Status:** Ready after the first V3 migration package is coordinated
- **Suggested branch:** `<name>/testing-progress`
- **Plan detail:** [Advanced testing](VERSION_3_PLAN.md#advanced-testing-and-performance-history)

Extend the shipped Testing Day feature with approved attempt/best-result rules,
comparison history, personal records, charts, correction audit, and selected
leaderboard metrics. Reuse the shared metric contract rather than creating a
second incompatible statistics system.

**Complete when:** Approved tests show historically correct comparisons and
records, corrections remain auditable, and only explicitly approved metrics
enter coach/member leaderboards.

---

## 9. Player Development Profiles And Evaluations

- **Status:** Needs visibility decisions
- **Suggested branch:** `<name>/player-development-profiles`
- **Plan detail:** [Player development profile](VERSION_3_PLAN.md#player-development-profile) · [Coach evaluations](VERSION_3_PLAN.md#coach-evaluations)

Add the baseball development card and versioned coach evaluations after
private, coach-visible, athlete-visible, and shareable fields are approved.

**Complete when:** Baseball data remains optional, evaluations preserve
history, every field follows its approved audience rule, and non-baseball
facilities do not receive irrelevant UI.

---

## 10. Throwing And Arm Care

- **Status:** Later; hitting comes first and privacy review is required
- **Suggested branch:** `<name>/throwing-arm-care`
- **Plan detail:** [Throwing and arm care](VERSION_3_PLAN.md#throwing-and-arm-care)

Add throwing and arm-care programming only after the medical/injury privacy,
consent, retention, disclaimer, and visibility decisions are documented.

**Complete when:** Approved programs and tracking work without duplicating the
workout engine, and sensitive information has explicit access and retention
controls.

---

## 11. Notifications, Private Notes, And Audit History

- **Status:** Later
- **Suggested branch:** `<name>/notifications-notes-audit`
- **Plan detail:** [Shared V3 extensions](VERSION_3_PLAN.md#4-shared-v3-extensions)

Build the private coach-note UI, generalized in-app notification/read state,
and audit history for sensitive owner, facility, import, evaluation, and result
actions. Email and push remain follow-ups.

---

## 12. Recruiting And Shareable Profiles

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
