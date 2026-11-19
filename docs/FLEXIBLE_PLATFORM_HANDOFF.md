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
