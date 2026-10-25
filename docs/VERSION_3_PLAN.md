# Rip City Version 3 Plan

This document is the source of truth for work intentionally deferred beyond
Version 2. V3 should begin only after V2 is released, Rip City has used it in
real training, and the team has reviewed coach/member feedback.

V3 has two major goals:

1. Expand the platform for real multi-facility operation.
2. Add the deeper baseball-development system built on top of the stable V2
   workout, goal, leaderboard, and account foundations.

This is a product-direction plan, not yet an ordered implementation backlog.
Before V3 work begins, convert approved sections into packages and branches the
same way V2 uses `V2_BACKLOG.md`.

---

## 1. Multi-Facility Platform Operations

### Platform Owner

- Add a storable `platform_owner` role for Derek and any explicitly trusted
  future operator.
- Only platform owners can create facilities.
- Platform-owner permissions must be enforced by RLS, not only hidden UI.
- Do not create an automatic cross-facility private-data bypass.
- Add an explicit, logged support mode before a platform owner can enter a
  facility's private member context.

### Multi-Facility Accounts

- Allow legitimate coaches/admins to belong to more than one facility.
- Keep ordinary members limited to one facility unless a future use case is
  intentionally approved.
- Let users select an active facility when they have multiple approved
  memberships.
- Store active facility context safely and evaluate every permission against
  that selected membership.
- Support different roles by facility, such as admin in one facility and coach
  in another.
- Never combine member lists, workouts, goals, notes, or reports across
  facilities accidentally.

### Facility Creation And Onboarding

- Create a platform-owner facility setup workflow.
- Configure facility name, slug, time zone, branding, terminology, modules,
  member types, groups, and the first facility admin.
- Provide a repeatable facility launch checklist and safe starter configuration.
- Make adding a second real facility mostly configuration instead of custom
  code.
- Keep facility archive and recovery rules separate from hard deletion.

### Facility Configuration And Module Visibility

- Build self-service facility settings rather than relying on custom code or
  manual database edits.
- Configure facility display name, logo, colors, terminology, supported member
  types, and default groups.
- Let each facility enable only the modules and member programs it uses,
  including workouts, habits, goals, leaderboards, announcements, progress,
  scheduling, and future payments.
- Keep H2K and other program-specific experiences optional and prevent disabled
  modules from appearing in member navigation or dashboards.
- Keep coach/admin tools visually consistent while allowing member-facing
  branding to reflect each facility.
- Inventory and replace hardcoded Rip City/H2K assumptions before onboarding a
  second real facility.
- Add a trusted workflow for managing universal exercises and facility
  overrides/hides.

### Facility Time And Date Rules

- Give every facility one authoritative IANA time zone.
- Store timestamps in UTC while calculating facility days, workout dates,
  habit days, Monday-Sunday weeks, streaks, announcement visibility, and
  leaderboard periods in the selected facility's time zone.
- Use shared facility-local date helpers instead of device-local assumptions.
- Verify behavior for users outside the facility time zone and across
  daylight-saving transitions.

---

## 2. Baseball Development System

### Player Development Profile

- Create a baseball-specific player card without making the shared member
  profile baseball-only.
- Support position, secondary position, graduation year, school/team, physical
  measurements, verified testing results, and development history.
- Define which information is private, coach-visible, facility-visible, or
  intentionally shareable.

### Testing And Evaluations

- Let coaches create testing sessions containing selected tests and assigned
  athletes/groups.
- Provide a fast coach-entry mode so staff can enter results for many athletes
  during a testing day.
- Preserve test definitions, units, attempts, dates, evaluator identity, and
  corrections.
- Distinguish coach-entered verified results from member-entered training data.
- Show progress over time and personal bests.
- Allow approved testing metrics and specific lifts to become leaderboard
  categories without exposing sensitive data.

Potential tests include sprint times, jump measurements, strength lifts,
throwing velocity, exit velocity, agility, mobility, and facility-defined
custom tests. The exact first list requires Rip City coach approval.

### Throwing And Arm Care

- Add throwing-program creation, assignment, scheduling, and completion.
- Add arm-care exercise/program tracking without duplicating the shared workout
  engine unnecessarily.
- Decide how workload, soreness/readiness, pitch counts, and recovery notes are
  recorded and who can view them.
- Treat medical or injury-related information as sensitive and define privacy,
  retention, and disclaimer requirements before implementation.

### Coach Evaluations

- Add structured evaluations with configurable categories and private coach
  notes.
- Preserve evaluation history instead of overwriting prior assessments.
- Decide whether athletes see all evaluations, selected summaries, or only
  coach-published feedback.

### Recruiting And Showcase Information

- Add recruiting/showcase fields only after privacy and sharing rules are
  approved.
- Separate internal development data from intentionally public/shareable player
  information.
- Do not publish a player card or link without explicit authorization and clear
  audience controls.

---

## 3. Shared V3 Extensions

- Add a private coach-note UI and generalized in-app notification/read-state
  system on top of the focused V2 announcement slice.
- Extend leaderboards to approved lifts and testing metrics.
- Connect goals to verified test results where useful.
- Add richer progress charts using stable V2 workout, habit, goal, and testing
  history.
- Consider email and push notifications after the in-app notification model is
  proven.
- Revisit parent/guardian access only after exact visibility and consent rules
  are approved.
- Add audit history for sensitive admin, support, evaluation, and verified-test
  actions.
- Add Testing Day multiple-attempt and best-result rules, comparisons over
  time, richer charts, and approved testing-result leaderboard integration.
  Official Testing Day entry remains coach/admin-only unless a later product
  decision explicitly replaces that rule.
- Add workout versioning and archive behavior, workout-to-habit automation,
  and database-level deduplication for overlapping assignment targets.
- Split the large shared stylesheet into ordered shared, component,
  authentication, coach, and member stylesheets without changing the shipped
  appearance.

---

## 4. Required Foundation Before V3 Coding

- V2 is released without unresolved production migration or data-preservation
  problems.
- Rip City coach/member feedback from real V2 use is documented.
- Platform-owner and support-mode permissions are designed before migration SQL.
- Multi-facility session context and RLS test cases are approved.
- Baseball testing fields, units, result ownership, correction rules, and
  privacy are decided with Rip City.
- Medical/injury-related features receive a separate privacy and risk review.
- Every V3 schema package has staging fixtures for at least two facilities and
  direct allowed/denied RLS tests.

---

## 5. Open Product Decisions

- Which baseball tests launch first?
- Who can correct a verified result and how is the old value retained?
- Which testing and lift metrics can members see on leaderboards?
- What evaluation content is private to coaches versus visible to athletes?
- What information may appear on a shareable player card?
- Does support mode require a reason, time limit, facility approval, or all
  three?
- When should the first real facility after Rip City be onboarded?

---

## 6. V3 Done Direction

V3 is successful when a second real facility can be onboarded safely without
custom rebuilding, legitimate multi-facility staff can switch context without
data leakage, and Rip City can run approved baseball testing/development
workflows while preserving privacy and historical accuracy.
