# V2 Roles And Permissions Matrix

This is the product-level access contract for Version 2. UI visibility and
Supabase RLS must both follow it. Hiding a button is never the security control.

The matrix describes the intended V2 behavior. The final section lists places
where the verified staging baseline does not enforce that behavior yet.

## Access Scope

- **Platform owner:** Derek-only global role. Manages facilities and universal
  configuration. Cross-facility private member-data access is not automatic;
  that requires a future explicit support mode.
- **Facility admin:** Facility-scoped. Can perform coaching work and broadly
  manage people, roles, groups, content, and settings in that facility.
- **Coach:** Facility-scoped. Can perform coaching workflows and manage ordinary
  members, but cannot create facilities or promote people to coach/admin.
- **Athlete / H2K member:** Facility-scoped member roles. Members access only
  their own authorized experience and relevant facility/group content.
- **Parent:** No V2 application access until parent visibility and RLS are
  intentionally implemented.

A person may have different roles in different facilities. Every permission is
evaluated against the selected facility membership, not a role from another
facility.

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

| Area | Platform owner | Facility admin | Coach | Athlete / H2K member |
| --- | --- | --- | --- | --- |
| Facilities | Create, view, configure, and archive facilities | View and configure own facility; cannot create/archive facilities | View basic own-facility information | View only information required for own experience |
| Branding, modules, and time zone | Manage every facility | Manage own facility | View effective configuration | Consume effective configuration only |
| Memberships | Manage through an intentional facility/admin workflow | View and manage all own-facility memberships and roles | View members; approve, reject, deactivate, and reactivate ordinary members only | View own membership only |
| Coach/admin roles | Assign or remove intentionally | Create, update, or deactivate own-facility coach/admin memberships | Cannot create or promote coach/admin memberships | No access |
| Member profiles | Access only through intentional facility/support context | View and manage profiles in own facility | View and coach-manage profiles in own facility | View/edit allowed fields on own profile only |
| Groups | Manage in selected facility | Create, view, edit, archive, and manage membership | Create, view, edit, archive, and manage membership | View own groups only |
| Workouts | Manage in selected facility | Full own-facility coaching access | Create, assign, edit, archive, and delete allowed drafts | View assigned workouts and log own results |
| Exercise library | Manage universal catalog and selected-facility content | Manage own facility exercises, overrides, and hides | Manage own facility exercises, overrides, and hides | Read exercises only through assigned workout experience |
| Habits | Manage selected-facility configuration | Manage facility habits and view facility member logs | Manage facility habits and view facility member logs | View applicable habits and manage own logs |
| Goals | Manage through selected facility context | Manage all goals for members in own facility | Create/manage facility-member goals and view member-created goals | Create/manage own goals; status-only updates on coach-created goals |
| Goal deletion | Delete within selected facility context | Delete any own-facility member goal after confirmation | Delete any own-facility member goal after confirmation | Delete only self-created goals after confirmation |
| Progress | Reserved until V2 progress rules are approved | Reserved until rules are approved | Reserved until rules are approved | Reserved until rules are approved |
| Leaderboards | View selected facility | View full own-facility leaderboards | View full own-facility leaderboards | View permitted top five plus own rank; only relevant member-type boards |
| Coach notes | Access only through intentional facility/support context | Read and manage all own-facility notes | Read all own-facility notes; create notes; edit/delete only own notes | No access |
| Announcements | Manage through selected facility | Manage all own-facility announcements | Create announcements and edit/delete only own announcements | View targeted announcements and manage own dismissal state |
| In-app notifications | Manage platform behavior, not another user's read state | View/manage facility delivery behavior | Create only through authorized facility actions | View and mark only own notifications as read |
| Parent links | No general private-data bypass | Manage own-facility links when parent access is implemented | Manage approved links when parent access is implemented | No V2 access |
| Facility deletion | No hard delete after history exists; archive instead | No access | No access | No access |

## Lifecycle Rules

- Deactivate people and memberships instead of deleting identity/history.
- Archive facilities and historical groups.
- Permanently delete only unused/draft workouts without assignments or logs.
- Archive workouts with assignments or member history.
- Goals use true deletion in V2 according to the creator/role rules above.
- Coaches edit/delete only their own notes; facility admins can manage all
  facility notes.
- Universal exercises are never deleted or edited by facility roles. A facility
  edit creates an override; a facility delete creates a facility-only hide.

## Required RLS Test Pattern

Every facility-scoped module must be tested with two facilities and at least:

- One facility admin in each facility.
- One coach in each facility.
- One athlete and one H2K member where applicable.
- One pending and one inactive membership.
- One coach with approved memberships in both facilities.
- Derek's future platform-owner account.

For each create/read/update/delete action, verify both the allowed request and a
same-role request targeting the other facility. A failed UI control is not
enough; the direct Supabase request must also be denied by RLS.

## Known Baseline Gaps

These are implementation gaps, not undecided product rules:

1. `profiles.global_role` currently allows only `member`, `coach`, and `admin`.
   The planned `platform_owner` value requires a new migration.
2. The browser access helper checks for `platform_owner`, but that state cannot
   be stored under the current constraint and has no complete RLS design yet.
3. The browser currently selects the first approved facility membership. V2
   needs an explicit facility-selection/session-context flow for legitimate
   multi-facility accounts.
4. Current goals RLS allows coaches/admins to write goals, while V2 also allows
   members to create and manage their own goals. Sam's Goals migration must
   close this gap and test creator-specific update/delete rules.
5. Several archive lifecycle fields and workflows do not exist yet.
6. Announcements and per-user notifications do not have their V2 tables yet.
7. Progress write permissions remain intentionally undecided.

Do not edit the verified initial baseline to close these gaps. Add reviewed,
timestamped migrations and test them on staging.
