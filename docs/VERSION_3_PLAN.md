# Rip City Version 3 Plan

**Status: Active planning and development.** V2 is complete and deployed. New
feature work belongs on branches created from `v3-development`; production
fixes remain separate branches from `main`.

For the ordered work queue, dependencies, and suggested branch boundaries, see
[`V3_BACKLOG.md`](V3_BACKLOG.md).

V3 has three primary goals, in this product order:

1. Strengthen the sellable workout and performance product with max tracking,
   percentage-based programming, and targeted improvements that directly help
   facilities program and review training.
2. Turn the proven Rip City application into a safely configurable platform
   where Derek and Sam can create a second real facility without exposing or
   mixing Rip City data.
3. Add a deeper baseball-development system, beginning with hitting and
   HitTrax/TrackMan data before throwing and arm-care work.

The shipped V2 workout builder, exercise library, assignment, logging, and
history workflows are stable foundations. V3 does not include a general
workout/exercise rebuild, but targeted workout enhancements that increase the
product's immediate value to facilities come before hitting-specific work.

---

## 1. Workout And Performance Enhancements

### Strength Maxes And Percentage-Based Programming

Extend the stable workout builder and Testing Day system instead of creating a
separate lifting workflow.

- Store a member's max by exercise, date, unit, source, and verification state.
- Keep directly tested or coach-entered maxes distinct from calculated
  estimates and from a coach-selected training max.
- Let coaches calculate an estimated max from a completed weight-and-reps set,
  while recording the formula and original inputs used for the estimate.
- Let coaches prescribe an exercise using a fixed load or a percentage of the
  member's selected verified, estimated, or training max.
- Show the resolved load for each member before assignment, flag members who
  do not have the required max, and allow an explicit coach override.
- Support facility-approved rounding rules so calculated loads match the
  equipment available to the facility.
- Snapshot the max, percentage, formula, and resolved load when a workout is
  assigned. Later max changes must not rewrite historical prescriptions.
- Allow approved Testing Day strength results to update max history and feed
  progress charts or leaderboards only when a coach confirms them.

Before implementation, decide which estimation formulas are supported, how a
training max is defined, which max source is the default for programming, and
which rounding increments each facility may use.

### Advanced Testing And Performance History

V2 already ships staff-created Testing Days, staff-only official result entry,
member-own result visibility, calendar markers, correction, and ranked review.
V3 extends that stable feature instead of rebuilding it.

- Add approved multiple-attempt and best-result rules.
- Add comparisons over time, personal records, richer charts, and consistent
  correction/audit history.
- Promote only coach-approved tests and lifts to leaderboards.
- Reuse the shared metric catalog so Testing Day and hitting data do not become
  unrelated reporting systems.

---

## 2. Multi-Facility Platform Operations

### Platform Owners

- Add a stored platform-level role for Derek and Sam only.
- Only platform owners can create, configure, archive, or restore facilities.
- Facility admins, coaches, and members remain scoped to one facility in the
  V3 product. Supporting ordinary staff across multiple facilities is not a V3
  requirement.
- Platform-owner permissions must be enforced by database functions and RLS,
  not only by hidden UI controls.
- Platform ownership must not become an automatic private-data bypass. Any
  future support access into a facility should be explicit, time-limited, and
  logged.

### Facility Creation And Isolation

- Build a platform-owner workflow that creates a facility and its first admin.
- Configure the facility name, slug, IANA time zone, branding, terminology,
  enabled modules, member programs, starter groups, and initial admin.
- Make facility creation transactional or safely resumable so a partial setup
  cannot leave an unusable facility.
- Keep every facility-owned row keyed to its facility and enforce that scope in
  RLS and trusted database functions.
- Verify a real second facility cannot read or change Rip City members,
  profiles, groups, workouts, exercises, goals, habits, announcements, Testing
  Days, results, leaderboards, or files.
- Keep facility archive and recovery separate from permanent deletion.
- Provide a repeatable launch checklist and safe starter configuration so a
  second facility is configuration work, not a custom rebuild.

### Facility Configuration And Module Visibility

- Provide facility settings for display name, logo, colors, terminology,
  supported member programs, default groups, and time zone.
- Let each facility enable only the modules it uses, including workouts,
  habits, goals, leaderboards, announcements, Testing Days, and future baseball
  modules.
- Prevent disabled modules from appearing in member navigation, dashboards,
  direct page access, or data queries.
- Keep coach/admin tools structurally consistent while member-facing branding
  reflects the active facility.
- Inventory and replace hardcoded Rip City and H2K assumptions before the
  second real facility launches.
- Keep universal exercises shared and immutable to facility staff. A facility
  may add private exercises and eventually override or hide a universal item
  without altering another facility or historical workouts.

### Facility Time And Date Rules

- Give every facility one authoritative IANA time zone.
- Store timestamps in UTC while calculating facility days, workout dates,
  habit days, weeks, streaks, announcement visibility, and leaderboard periods
  in the facility time zone.
- Use shared facility-local date helpers instead of device-local assumptions.
- Verify daylight-saving boundaries and users viewing the app from a different
  time zone.

---

## 3. Baseball Development System

### Hitting Data Foundation

Hitting is the first baseball-specific V3 area and comes before throwing or arm
care.

- Define one source-neutral hitting metric catalog for measurements such as
  exit velocity, launch angle, distance, hard-hit rate, bat speed, attack angle,
  and facility-approved custom metrics.
- Support HitTrax and TrackMan without making either vendor's field names the
  application's permanent data model.
- Start with the safest available ingestion method—manual entry or approved
  CSV import—while official API access, export formats, costs, and terms are
  confirmed with each vendor.
- Preserve source, source event/session ID, observed time, unit, import time,
  raw-source reference, verification state, and correction history.
- Build a review step for athlete matching, units, duplicates, invalid rows,
  and corrections before imported results become official.
- Never scrape or automate a vendor system in a way its agreement does not
  permit.

### Hitting Development Experience

- Show verified hitting results and trends on the member's baseball
  development profile.
- Let coaches review sessions, filter metrics, compare date ranges, and see
  personal bests without exposing another facility's data.
- Connect approved hitting metrics to goals, progress charts, Testing Day
  history, and later leaderboards through the shared metric registry.
- Keep coach-entered, imported, and member-entered data visibly distinct.

### Player Development Profile

- Add a baseball-specific player card without making the shared member profile
  baseball-only.
- Support position, secondary position, graduation year, school/team, physical
  measurements, verified results, goals, and development history.
- Define which information is private, coach-visible, facility-visible, or
  intentionally shareable.

### Coach Evaluations

- Add structured evaluations with configurable categories and private coach
  notes.
- Preserve evaluation history rather than overwriting earlier assessments.
- Decide whether athletes see all evaluations, selected summaries, or only
  explicitly published feedback.

### Throwing And Arm Care

This work follows the hitting foundation.

- Add throwing-program creation, assignment, scheduling, and completion.
- Add arm-care tracking without duplicating the shared workout engine.
- Decide how workload, soreness/readiness, pitch counts, and recovery notes are
  recorded and who may view them.
- Treat medical or injury-related information as sensitive. Complete a separate
  privacy, retention, consent, and disclaimer review before implementation.

### Recruiting And Showcase Information

- Add recruiting/showcase fields only after privacy and sharing rules are
  approved.
- Separate internal development data from intentionally shareable player data.
- Never publish a player card or link without explicit authorization and clear
  audience controls.

---

## 4. Shared V3 Extensions

- Add private coach-note UI and a generalized in-app notification/read-state
  system on top of V2 announcements.
- Extend leaderboards only to approved lifts, tests, and hitting metrics.
- Connect goals to verified results where useful.
- Add richer progress charts using stable workout, habit, goal, Testing Day,
  and hitting history.
- Consider email and push after the in-app notification model is proven.
- Revisit parent/guardian access only after exact consent and visibility rules
  are approved.
- Add audit history for sensitive facility setup, platform support,
  evaluations, imports, and verified-result corrections.
- Split the large shared stylesheet into ordered shared, component,
  authentication, coach, and member stylesheets as a behavior-neutral
  maintenance package when it will not collide with active feature work.

---

## 5. Required Safety Rules

- Every schema change starts as a timestamped repository migration, runs on
  staging first, and receives focused allowed/denied tests.
- Every facility-aware package uses at least two facility fixtures and proves
  both permitted same-facility behavior and denied cross-facility behavior.
- Only one shared staging schema migration package should be in flight at a
  time unless Derek and Sam explicitly coordinate otherwise.
- Real production data is never copied into staging.
- Vendor imports require fake or approved sample files before implementation.
- Sensitive medical, evaluation, recruiting, and support-mode features require
  their privacy rules before code is merged.
- Production remains on `main`; V3 feature branches merge through
  `v3-development` and reach `main` only through a reviewed release.

---

## 6. Open Product Decisions

- Which HitTrax and TrackMan exports or APIs can Rip City provide and use?
- Which hitting metrics should launch first and which may appear to members?
- How should imported athletes be matched when vendor names or IDs differ?
- Which Testing Day metrics may appear on member leaderboards?
- What evaluation content is private versus athlete-visible?
- What information may appear on a shareable player card?
- What exact controls are required before Derek or Sam can enter a facility's
  private support context?
- Which facility should become the first real facility after Rip City?

---

## 7. V3 Done Direction

V3 is successful when Derek or Sam can create and launch a second real facility
without custom rebuilding or cross-facility data leakage, and Rip City can use
an approved hitting-development workflow with trustworthy HitTrax/TrackMan data
while preserving privacy, source history, and corrections.
