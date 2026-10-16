# Product Decisions

This file captures current product rules that should guide implementation until
they are intentionally revisited.

## Version Scope

- V2 stabilizes the shared multi-facility platform and finalizes the core
  workout creation, editing, assignment, logging, and history experience.
- V3 is the planned deeper baseball-development expansion.
- Baseball metrics, throwing and arm-care programs, player cards, evaluations,
  recruiting, and related sport-specific workflows should wait for V3 unless
  Derek and Sam intentionally change the roadmap.

## Facility Isolation

- Rip City is the first facility, not a separate codebase.
- Coaches/admins should only manage users, workouts, goals, notes, and reports
  inside their own facility.
- Each facility should feel separate, but the app should remain one shared
  multi-facility platform.

## Platform Owner

- Platform owner access is intended for Derek and future trusted operators only.
- Platform owner should manage facility/admin/config data by default.
- Cross-facility member data access should require an explicit support mode later,
  not happen as an accidental universal bypass.
- Only Derek/platform owner can create facilities in V2.

## Facility Memberships And Roles

- Ordinary members should belong to one facility.
- Derek and coaches/admins who legitimately work with multiple facilities may
  have multiple facility memberships.
- Roles are facility-specific: a person may be an admin in one facility and a
  coach in another.
- Facility admins can perform coaching work and broadly manage their facility.
- New signups remain pending until a facility coach/admin approves them.
- The platform owner establishes the first facility admin. After that,
  facility admins control coach onboarding for their own facility, including
  creating/inviting coaches or approving a pending coach request.
- Ordinary coaches cannot approve, promote, or create coach/admin memberships.
- Deactivation preserves history; reactivation restores the existing historical
  relationships.

## Signup Links

- Preserve the current coach workflow: copy an Athlete, H2K, or general signup
  link and send it to prospective members.
- Links may be shared and do not need to be email-bound or single-use in V2.
- A signup link never bypasses pending approval.

## Facility Time

- Every facility has one authoritative IANA time zone.
- Rip City uses `America/New_York`.
- Store timestamps in UTC and calculate facility calendar rules in the facility time zone.

## Lifecycle

- Deactivate people and memberships rather than deleting their history.
- Archive historical facilities and groups.
- Coaches may permanently delete unused/draft workouts.
- Workouts with assignments or member logs should normally be archived so the
  normal UI stays clean without losing history.

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

- A proposed Testing Day workflow would let a coach create a testing session,
  select a group or members, define ordered tests, and enter the roster's
  results from one screen.
- Testing sessions should be separate from ordinary workouts and should connect
  approved results to progress history and the existing leaderboard metric
  selector.
- Test definitions, attempts/best-result rules, member visibility, and
  leaderboard eligibility remain pending the Rip City coach discussion on
  2026-10-18.

## H2K

- H2K is a Rip City-specific member type/module.
- Other facilities should not be assumed to use H2K.
- H2K habits should remain optional program-specific functionality inside the
  shared member dashboard.

## Exercise Library Inheritance

- Coaches see one combined exercise library, not separate universal and
  facility lists.
- Derek/platform owner manages universal exercises.
- Coaches may create exercises visible only to their own facility.
- Editing a universal exercise automatically creates a facility override and
  leaves the universal exercise unchanged for other facilities.
- Deleting a universal exercise hides it only for that facility.
- Facilities without an override continue receiving universal updates.
- Exercise overrides, hiding, and catalog updates must not alter historical
  workouts or logged results.
