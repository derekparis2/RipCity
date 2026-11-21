# Flexible platform implementation — November 18, 2026

Implementation only. Derek requested that browser, staging, and actual test
execution be left to him. JavaScript syntax and whitespace checks were performed;
the test suite and new SQL were not executed by the agent in this phase.

## Implemented

- Shared neutral login. Authoritative global-owner status routes normal login,
  recovery, and post-legal destinations to Platform. Platform owners are stored
  by profile in `app_private.platform_owners`, with no facility ID; facilities
  never create another owner account. Existing staging owner identities are
  separate test people, not required per-facility owner accounts. No accounts
  were merged, deleted, or granted ownership by this change.
- Member registration from a facility code or supplied link. Staff can copy code
  links from Roster/Configure; admins and owners can rotate the facility code.
  Codes identify a facility and never approve access. Coach/admin invitations
  remain single-use, expiring staff invites. Legacy slug links remain compatible.
- Any number of named programs per facility. New registration selects exactly
  one. Each program has its own feature overrides and registration-detail shape.
- Membership's program is independent of legacy profile types. Existing role,
  profile, and log records are preserved. Legacy athlete/general profile shapes
  remain internal compatibility fields rather than a limit on program count.
- Existing programs can be renamed or disabled without deleting their members.
  Registration-detail shape/key changes are rejected once a program has members.
- Roster program filters/stats, approvals, coach/member leaderboards, profiles,
  workout-session labels, and group eligibility use configured program keys.
- Groups can be program-specific or shared. New program-specific groups accept
  existing profile shapes while enforcing the selected program. Existing group
  scopes and member history are preserved.
- Facility admins can change a member's single program without rewriting saved
  results or profile fields. They must remove incompatible program-group links
  first; the server enforces this and records an audit event.
- Program announcements snapshot currently approved recipients using the existing
  targeted-announcement RPC; new members do not retroactively receive that post.
- Configurable coach/member welcome headings/messages and feedback/score widgets.
- Secondary color now visibly styles headers, hero borders, sidebar accents,
  outlined controls, and active navigation.

## Staging migration

Apply `supabase/migrations/20261118120000_add_flexible_facility_programs_and_registration.sql`
after the earlier facility migrations, including `20261117200000`. Do not edit or
rerun already-applied migrations. The new migration is transactional; it adds
and backfills program membership before enabling cross-facility foreign keys,
keeps old RPC signatures, and adds overloads for the new signup/config payloads.
Deploy the updated preview only after schema application succeeds.

This migration has not been run against PostgreSQL by the agent. Keep the full
error if application fails; do not run partial repair statements.

## Derek's focused checks

1. Run `node --test tests/*.test.mjs`, then the updated facility configuration,
   signup, provisioning, and admin-invite staging scripts.
2. With one global owner account, log in and land directly on Platform. Open two
   different facilities, then exit support. No second owner identity is needed.
3. In a fake facility, add at least three programs, configure different member
   features, save, and reopen. Confirm their names/settings and page content
   persist. Existing member-program links must survive configuration edits.
4. Register through a code and a copied link. Verify the facility name and all
   enabled programs. Register in the third program; confirm pending membership,
   program-specific group approval, labels, and feature availability after login.
5. Rotate the code. Verify the old code/code-link fails, including a signup form
   opened before rotation; the new code works. Existing users still log in.
6. Create a program-specific group and a shared group. Reject cross-program and
   cross-facility group memberships. Rename/disable a program without losing data.
7. Change an existing member's program as admin. Reject the change while they
   still belong to incompatible program groups. Remove those links and retry.
   Confirm old set logs/profile data remain intact and only one program is active.
8. Check program leaderboard isolation even when programs share the same
   registration-detail shape or a member moves between program shapes.
9. Check staff programme announcements reach only their snapshotted recipients.
10. Verify secondary color, themes, welcome copy, and widget visibility on member
    and coach pages. Disabling habit scores must never reveal a disabled module.
11. Check direct URLs, expired/reused staff invites, archived facilities, non-admin
    code rotation/program changes, member data isolation, and support restoration.

Dedicated domains, fees, and sales processes are outside this PR, per the agreed
scope. No browser tests, live account changes, migrations, commits, or pushes were
performed by the agent during this phase.

## November 21 — owner-configured design styles

New migration: `20261121190000_add_facility_style_customization.sql`, after
`20261118120000`. Apply to staging before deploying the updated configuration
form. This migration has not been applied or executed by the agent.

Performance retains the existing design. Clean and Community are opt-in styles
on the existing feature pages, with different typography, surfaces, card shapes,
spacing, and navigation treatment. No existing facility is restyled automatically.
The separate `appearance_settings` object defaults to `{}` (Performance/default
background) and is guarded against non-owner changes, including direct writes.
The existing config RPCs remain available; new overloads save appearance and the
other configuration fields in the same transaction and record an audit event.

Configure Facility adds a sample member/coach preview, background preference,
explicit suggested-color button, and dashboard section visibility/order controls.
Primary/secondary colors, logo, terminology, feature switches and welcome copy
remain editable. Suggested colors never replace the saved colors automatically.
The preview is a representative layout, not a live account or exact full-page
screenshot. Feature access remains governed by the original module/security rules.
Hiding a section does not revoke access to a feature; disable the feature instead.

Derek's checks (not executed by the agent):

- Apply the new migration; run the test suite, including
  `tests/facility-appearance.test.mjs`, and the existing configuration scripts.
- Verify Rip City's Performance/default setting looks the same as before.
- In a fake facility, preview/save/reopen all three styles and background modes.
  Confirm colors/logo/copy persist, and suggested colors change only on click.
- Reorder/hide member and coach sections independently, reload the actual
  dashboards, and confirm headers remain in place and data/actions still work.
- Disable modules while showing their sections; disabled features must stay hidden.
- Check real member/staff pages at desktop/mobile widths, including forms,
  calendars, rosters, workout sessions, nav menus, and text contrast.
- Confirm a facility admin/member cannot save appearance through the new RPCs
  or directly change `facilities.appearance_settings`; a global owner can.
- Check reload/navigation keeps the selected facility's style without a flash.

Only JavaScript syntax and whitespace checks were run by the agent. No optional
Performance redesigns, staging changes, commits, pushes, or browser QA were done.

## Performance polish and member workout flow

No migration is needed for this pass. Performance keeps its existing fonts,
palette and page structure, with quieter secondary accents and consistent card
and button shapes. Staff navigation now puts secondary destinations under More.
The dashboard links directly to pending approvals and habit follow-ups; empty
workout-library and assignment screens explain the next action.

Member sessions keep unsaved drafts in page memory while switching sets, blocks,
or overview. Drafts are not durable offline storage: leaving/reloading the page
can discard them, so browser unload and explicit refresh/logout warn first.
Save & Next validates results, blocks overlapping writes, and retains edits on
failure. Weight accepts non-negative decimals (0 for bodyweight); reps accept
non-negative whole numbers. Completion-only exercises need the completion check.
Members may skip a set for now without falsely recording it completed. Prior-set
zero weights/reps are preserved. The last save returns to overview; the completed
summary appears only when every set is saved and no drafts remain. HTTPS exercise
demo links open separately. Calendar actions distinguish Open, Continue, Review.

Derek's checks (not executed by the agent):

- Run the suite, including `tests/member-workout-flow.test.mjs`.
- Verify desktop/mobile More navigation, active secondary page, Escape/outside
  dismissal, enabled-module filtering, and facility-preserving links/new tabs.
- As coach and admin, check pending approval counts and follow-up links. Disabled
  habits must not expose habit actions; verify empty-library and calendar links.
- Start/continue/review a workout from the calendar, including an early workout.
- Type a result, move Previous/block/overview, and return. Try refresh/logout and
  cancel; edits should remain. Browser reload/leave should warn while unsaved.
- Save bodyweight 0, decimal weight, and zero reps. Reject missing/negative values,
  fractional reps and unchecked completion sets. Check band/time/distance/custom
  result types, notes/difficulty, and round-by-round prefilled previous results.
- Double-click Save, simulate a failed request, retry, and check exactly one set
  record and accurate saved progress. Inputs/navigation should recover on failure.
- Skip sets, save the final set, resume remaining sets, and verify the completed
  summary appears only after everything is saved. Check demo links if configured.
- Check phone keyboard, save-button visibility, focus movement, and small screens.

Only syntax/whitespace checks were run in this pass. No migration, live data,
browser testing, test execution, commit, or push was performed by the agent.

### Finish Workout and phone follow-up

Finish Workout is available in the session header; the final-set action is Save &
Finish Workout. Finish saves an edited current set, redirects to any other drafts
that still need saving, then opens a summary of saved and unlogged sets. It does
not create a separate finished status or mark unlogged sets completed. Members
can continue a partial workout later through the calendar. Errors stay in the
session and release the save lock. No migration is needed.

Phone-specific updates increase input text to 16px, enlarge input/button touch
areas, add safe-area padding to save actions, and stack summary actions full width.
Check on an actual phone with the keyboard open, including Finish with a current
edit, drafts in another block, skipped sets, every set saved, and a failed request.
The agent performed syntax/whitespace checks only, not browser or test execution.

### Review adjustment: navigation and dashboard shortcuts

At Derek’s request, restored the full staff tab list and removed the new pending-approval/follow-up shortcut strip, including its extra count query. The existing Approvals page and Needs Attention section remain available.

### Desktop navigation review follow-up

Restored outlined desktop tabs with larger text and a subtle filled active state.
All page destinations remain visible; Exit Admin Mode is grouped with Log Out.
Staff Profile uses the staff header/width/navigation; member Profile keeps its
member shell. Beta feedback is limited to Rip City, where its configuration switch
can still turn it off. Other facilities do not show the beta feedback widget.
No migration is required. Browser review, including mobile/member pages, remains
with Derek; only JavaScript syntax and whitespace checks were run by the agent.

### Incomplete sets may continue

Next advances when required results are missing and retains any draft. Complete
results still use Save & Next. Finish collects edits across sets and asks for
confirmation if any sets are incomplete. Cancel keeps edits and the current view.
Confirmed finishing saves valid partial entries with completed=false, preserving
entered values without inflating completion. Invalid numeric entries are explicitly
identified as unsavable in the confirmation. The final set now uses this same
Finish path. Verify blank/partial Next, cancel/confirm Finish, saved partial values,
and resume on a phone. Tests were updated but not run by the agent.

### Assignment warnings and group-form feedback

New/reused workout assignments and program launches check the current facility
calendar and ask for confirmation when the same roster or overlapping members
already have a workout on those dates. Existing workouts stay in place. Calendar
copy retains its existing destination-conflict protections. This is an advisory
preflight, not a database uniqueness rule; concurrent assignments after the check
can still occur. Reads are scoped and paginated rather than using the library cache.

Group-creation messages appear inside the form; errors use role=alert, receive
focus and scroll into view. Inputs are retained on failure and repeated submits
are blocked while creating. Workout navigation now always labels its single
advance button Next, whether saving results or advancing without them.

Derek: test duplicate-date group/member/facility assignments, overlapping groups,
cancel/confirm, new vs reused workouts, and program launches. Try blank/duplicate
group names and a rejected insert on desktop/phone; verify the inline error and
retained fields. Run tests/workout-assignment-warning.test.mjs with the suite.
Only syntax/whitespace checks were performed by the agent; no migration needed.
