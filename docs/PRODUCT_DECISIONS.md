# Product Decisions

This file captures current product rules that should guide implementation until
they are intentionally revisited.

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
- Historical recipient snapshots may be considered later if reporting needs it.

## H2K

- H2K is a Rip City-specific member type/module.
- Other facilities should not be assumed to use H2K.
- H2K habits should remain optional program-specific functionality inside the
  shared member dashboard.
