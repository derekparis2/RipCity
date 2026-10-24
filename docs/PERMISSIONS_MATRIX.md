# V2 Roles And Permissions Matrix

This is the product-level access contract for Version 2. UI visibility and
Supabase RLS must both follow it. Hiding a button is never the security control.

The matrix describes the intended V2 behavior. The final section lists places
where the verified staging baseline does not enforce that behavior yet.

## Access Scope

V2 presents one active facility membership per account. Work outside that
boundary is defined in [`VERSION_3_PLAN.md`](VERSION_3_PLAN.md).

- **Facility admin:** Facility-scoped. Can perform coaching work and broadly
  manage people, roles, groups, content, and settings in that facility.
- **Coach:** Facility-scoped. Can perform coaching workflows and manage member
  training data, but cannot approve, reject, deactivate, or reactivate accounts
  or create/promote people to coach/admin.
- **Athlete / H2K member:** Facility-scoped member roles. Members access only
  their own authorized experience and relevant facility/group content.
- **Parent:** No V2 application access until parent visibility and RLS are
  intentionally implemented.

Within V2, every permission is evaluated against the account's single active
facility membership.

## Membership Status

| Status | Access |
| --- | --- |
| `pending` | May view only the pending-account experience and own signup state; cannot access protected facility data. |
| `approved` | Receives the permissions of the membership role for that facility. |
| `rejected` | Receives no facility application access. |
| `inactive` | Receives no normal facility application access; identity and history remain stored for reactivation. |

Reactivation reuses the existing membership and restores its authorized
historical relationships. It must not create a disconnected replacement user.

## Module Permissions

| Area | Facility admin | Coach | Athlete / H2K member |
| --- | --- | --- | --- |
| Facilities | View own facility; configuration UI is deferred to V3; cannot create/archive facilities | View basic own-facility information | View only information required for own experience |
| Branding, modules, and time zone | No V2 settings UI; future management is defined in V3 | No V2 management access | Consume the current Rip City experience only |
| Memberships | View and manage all own-facility memberships and roles; select an athlete's initial group during approval | View own-facility members; cannot approve, reject, deactivate, reactivate, or change account roles | View own membership only; cannot select a signup group |
| Coach/admin roles | Create, update, or deactivate own-facility coach/admin memberships | Cannot create or promote coach/admin memberships | No access |
| Coach invitations | Create seven-day, single-use coach links for own facility | Cannot create coach links | May claim a valid link, which creates pending access only |
| Member profiles | View and manage profiles in own facility | View and coach-manage profiles in own facility | View/edit allowed fields on own profile only |
| Groups | Create, view, edit, archive/delete, and manage membership for all own-facility groups | Create groups; edit/delete only own groups; add members to facility groups; remove members only from own groups | View own groups only |
| Workouts | Full own-facility coaching access | Create, assign, edit, archive, and delete allowed drafts | View assigned workouts and log own results |
| Exercise library | Manage own-facility exercises, overrides, and hides | Manage own-facility exercises, overrides, and hides | Read exercises only through assigned workout experience |
| Habits | Manage facility habits and view facility member logs | Manage facility habits and view facility member logs | View applicable habits and manage own logs |
| Goals | Manage all goals for members in own facility | Create/manage facility-member goals and view member-created goals | Create/manage own goals; status-only updates on coach-created goals |
| Goal deletion | Delete any own-facility member goal after confirmation | Delete any own-facility member goal after confirmation | Delete only self-created goals after confirmation |
| Progress | Reserved until V2 progress rules are approved | Reserved until rules are approved | Reserved until rules are approved |
| Leaderboards | View full own-facility leaderboards | View full own-facility leaderboards | View permitted top five plus own rank; only relevant member-type boards |
| Coach notes | Read and manage all own-facility notes | Read all own-facility notes; create notes; edit/delete only own notes | No access |
| Announcements | Manage all own-facility announcements | Create announcements and edit/delete only own announcements | View targeted announcements and manage own dismissal state |
| In-app notifications | View/manage facility delivery behavior | Create only through authorized facility actions | View and mark only own notifications as read |
| Parent links | Manage own-facility links when parent access is implemented | Manage approved links when parent access is implemented | No V2 access |
| Facility deletion | No access | No access | No access |

Coach onboarding follows the elevated-role row above: the platform owner
establishes the first facility admin, and an existing facility admin creates,
invites, or approves later coaches/admins for that facility. Ordinary coaches
can review pending requests but cannot make account-lifecycle decisions for
members, coaches, or admins. Invite possession alone never grants an elevated
membership.

## Lifecycle Rules

- Deactivate people and memberships instead of deleting identity/history.
- Archive facilities and historical groups.
- Permanently delete only unused/draft workouts without assignments or logs.
- Archive workouts with assignments or member history.
- Goals use true deletion in V2 according to the creator/role rules above.
- Coaches edit/delete only their own notes; facility admins can manage all
  facility notes.
- Coaches delete groups and remove existing group members only from groups they
  created. Facility admins retain full own-facility group management. Seeded or
  legacy groups without a creator are admin-managed.
- Athlete signup creates a pending membership and member profile without a
  group. A facility admin selects a same-facility athlete group during approval,
  and the database performs both actions atomically. Pending athletes cannot
  self-assign a group or be approved without one.
- Universal exercises are never deleted or edited by facility roles. A facility
  edit creates an override; a facility delete creates a facility-only hide.

## Required RLS Test Pattern

Every facility-scoped module must be tested with two facilities and at least:

- One facility admin in each facility.
- One coach in each facility.
- One athlete and one H2K member where applicable.
- One pending and one inactive membership.
- Dedicated coaches in both facilities for cross-facility denial testing. V2
  fixtures should not give one identity memberships in both facilities.

For each create/read/update/delete action, verify both the allowed request and a
same-role request targeting the other facility. A failed UI control is not
enough; the direct Supabase request must also be denied by RLS.

## Known Baseline Gaps

These are implementation gaps, not undecided product rules:

1. Several archive lifecycle fields and workflows do not exist yet.
2. Announcements and per-user notifications do not have their V2 tables yet.
3. Progress write permissions remain intentionally undecided.

The secure coach-invite migration was applied to staging and passed all 12
coach-invite/RLS checks on 2026-10-16. Production remains unchanged.

Do not edit the verified initial baseline to close these gaps. Add reviewed,
timestamped migrations and test them on staging.
