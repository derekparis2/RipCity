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

