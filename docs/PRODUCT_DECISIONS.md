# Product Decisions

This file captures current product rules that should guide implementation until
they are intentionally revisited.

## Version Scope

- V2 stabilizes the facility-isolated platform foundation and finalizes the
  core workout creation, editing, assignment, logging, and history experience.
- Work beyond the V2 boundary is maintained in
  [`VERSION_3_PLAN.md`](VERSION_3_PLAN.md).

## Facility Isolation

- Rip City is the first facility, not a separate codebase.
- Coaches/admins should only manage users, workouts, goals, notes, and reports
  inside their own facility.
- Each facility should feel separate, but the app should remain one shared
  multi-facility platform.

## Facility Memberships And Roles

- V2 supports one active facility membership per account in the product UI.
- The second staging facility and its dedicated Alpha accounts exist only to
  test isolation. V2 test identities each belong to one facility.
- Facility admins can perform coaching work and broadly manage their facility.
- New signups remain pending until a facility admin approves them.
- The platform owner establishes the first facility admin. After that,
  facility admins control coach onboarding for their own facility, including
  creating/inviting coaches or approving a pending coach request.
- Ordinary coaches can review pending requests but cannot approve, reject,
  deactivate, reactivate, promote, or create facility memberships. A future
  request/flag workflow may let them ask an admin to review an account.
- Athletes and H2K members do not choose a group during signup. A facility
  admin must select the member's initial matching same-facility group as part
  of approval; group assignment and approval succeed or fail together.
- Deactivation preserves history; reactivation restores the existing historical
  relationships.

## Signup Links

- Preserve the current coach workflow: copy an Athlete, H2K, or general signup
  link and send it to prospective members.
- Athlete, H2K, and general member links remain reusable and may be sent in a
  group email.
- Coach links are created only by facility admins, expire after seven days,
  and are single-use. Claiming one creates a pending coach membership that an
  admin in the invited facility must approve.
- Coach links do not need to be email-bound in V2, but should be sent only to
  the intended coach.
- A signup link never bypasses pending approval.

## Facility Time

- Rip City uses `America/New_York`.
- Store timestamps in UTC and keep Rip City calendar rules correct for its time
  zone during V2.
- Generalized per-facility time-zone configuration and date helpers are V3
  scope.

## Lifecycle

- Deactivate people and memberships rather than deleting their history.
- Archive historical facilities and groups.
- Coaches may permanently delete unused/draft workouts.
- Workouts with assignments or member logs should normally be archived so the
  normal UI stays clean without losing history.

## Group Ownership

- Facility admins can edit/delete every own-facility group and add/remove any
  own-facility group membership.
- Coaches can create groups and add members to facility groups, but can delete
  a group or remove an existing member only when they created that group.
- Seeded and legacy groups without a recorded creator are admin-managed.
- Group ownership restrictions must be enforced by RLS as well as the roster UI.

## Notifications

- V2 begins with in-app notifications only.
- Email and push remain future options unless scope is intentionally expanded.
- Staging uses entirely fake member and facility data.

## Workout Editing And History

- For now, members may edit old workout logs.
- For now, coaches may edit workouts even after members have logged results.
- These rules may change after Rip City customer conversations.
- If stricter rules are added later, preserve historical workout data carefully.

## Assignment Recipients

- Facility-wide and group workout assignments currently apply dynamically.
- If a member joins the facility/group later, they should receive matching current
  assignments under the existing visibility model.
- Multiple active coaches/admins in the same facility may assign authorized
  workouts, including workouts created by another coach in that facility.
- Members and coach review/history views should show who assigned each workout.
- Duplicate workout/target/date assignments must be prevented safely even when
  two coaches assign at nearly the same time.
- Historical recipient snapshots may be considered later if reporting needs it.

## Testing Days

- Testing Days are separate from ordinary workouts and appear within Training.
- Coaches and facility admins can create drafts or scheduled days, choose any
  combination of groups and individuals, and define ordered reusable or custom
  tests.
- The selected roster is snapshotted and deduplicated. A member selected through
  two groups or through both a group and direct selection appears only once.
- Assigned members can see the scheduled day and test battery, but not results.
- Result storage exists as a locked foundation. No authenticated role can write
  results until Rip City decides who enters official results.
- Attempt/best-result behavior, result visibility, comparisons, and leaderboard
  eligibility remain pending.

## H2K

- H2K is a Rip City-specific member type/module.
- Other facilities should not be assumed to use H2K.
- Rip City's V2 habits are shared by H2K members and athletes. H2K-only profile
  fields such as band color remain program-specific; configurable habit-module
  availability for other facilities belongs to V3.

## Exercise Library Inheritance

- Coaches see one combined exercise library, not separate universal and
  facility lists.
- Derek manages universal exercises through the approved manual V2 process.
- Coaches may create exercises visible only to their own facility.
- Editing a universal exercise automatically creates a facility override and
  leaves the universal exercise unchanged for other facilities.
- Deleting a universal exercise hides it only for that facility.
- Facilities without an override continue receiving universal updates.
- Exercise overrides, hiding, and catalog updates must not alter historical
  workouts or logged results.
