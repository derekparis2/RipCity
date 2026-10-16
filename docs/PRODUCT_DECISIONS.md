# Product Decisions

This file captures current product rules that should guide implementation until
they are intentionally revisited.

## Version Scope

- V2 stabilizes the facility-isolated platform foundation and finalizes the
  core workout creation, editing, assignment, logging, and history experience.
- V3 is the planned deeper baseball-development expansion.
- V3 also adds the global platform-owner workflow, multi-facility account
  selection, and supported cross-facility administration.
- Baseball metrics, throwing and arm-care programs, player cards, evaluations,
  recruiting, and related sport-specific workflows should wait for V3 unless
  Derek and Sam intentionally change the roadmap.

## Facility Isolation

- Rip City is the first facility, not a separate codebase.
- Coaches/admins should only manage users, workouts, goals, notes, and reports
  inside their own facility.
- Each facility should feel separate, but the app should remain one shared
  multi-facility platform.

## Platform Owner And Multi-Facility Accounts

- Platform owner access is intended for Derek and future trusted operators only.
- Platform owner should manage facility/admin/config data by default.
- Cross-facility member data access should require an explicit support mode later,
  not happen as an accidental universal bypass.
- The storable platform-owner role, facility creation UI, support mode, and
  active-facility selector are deferred to V3.
- In V2, each account operates through one active facility membership. The
  second staging facility and cross-facility coach exist only to test isolation.

## Facility Memberships And Roles

- V2 supports one active facility membership per account in the product UI.
- Legitimate multi-facility memberships and facility-specific role switching
  are V3 workflows.
- Facility admins can perform coaching work and broadly manage their facility.
- New signups remain pending until a facility coach/admin approves them.
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
- Historical recipient snapshots may be considered later if reporting needs it.

## H2K

- H2K is a Rip City-specific member type/module.
- Other facilities should not be assumed to use H2K.
- H2K habits should remain optional program-specific functionality inside the
  shared member dashboard.

## Exercise Library Inheritance

- Coaches see one combined exercise library, not separate universal and
  facility lists.
- Derek manages universal exercises through the approved manual V2 process;
  platform-owner UI is V3 scope.
- Coaches may create exercises visible only to their own facility.
- Editing a universal exercise automatically creates a facility override and
  leaves the universal exercise unchanged for other facilities.
- Deleting a universal exercise hides it only for that facility.
- Facilities without an override continue receiving universal updates.
- Exercise overrides, hiding, and catalog updates must not alter historical
  workouts or logged results.
