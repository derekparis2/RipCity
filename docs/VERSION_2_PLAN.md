# Rip City Version 2 Plan

Version 2 should build on the live beta by turning Rip City from a workout/habit
logger into a fuller athlete development platform.

Core V2 direction:

- Platform / multi-facility configuration
- Goals
- Leaderboards
- Progress tracking
- Coach notes
- Profile and community upgrades

Do not start coding these sections until the product rules below are filled in.

---

## 1. Platform / Multi-Facility Direction

### Product Purpose

Rip City is the first beta facility, not the full identity of the product. The product should become a facility-configurable coaching platform that can support many gyms, academies, teams, and training programs without rebuilding the app for each one.

The long-term goal is for a facility to choose its modules, colors, logo, groups, member types, and terminology with little or no custom code work from Derek.

### Decisions

- Rip City stays the beta/proof facility.
- New shared features should be built for any facility first, then configured for Rip City.
- Facility-specific features should be optional modules, not hardcoded platform behavior.
- H2K habits should remain a Rip City/member-type module unless another facility enables a similar habit module.
- Derek/global admin should be the only role that can see or manage all facilities unless a future support/admin mode is intentionally added.
- Facility coaches/admins should only manage their own facility.
- Members should only see their own facility experience.
- Facility branding should move toward data/config-driven behavior instead of one-off CSS edits.
- Manual setup is acceptable early, but V2 should avoid choices that block future self-serve setup.
- Only Derek/global admin can create facilities in V2.
- The data model may support more than one facility membership, but ordinary
  members should use one facility. Multiple memberships are reserved for Derek
  and coaches/admins who legitimately work with more than one facility.
- A person's role belongs to each facility membership. The same person may be a
  facility admin in one facility and a coach in another.
- Reactivating a membership should restore its historical facility, group,
  workout, goal, and other authorized relationships rather than create a new
  disconnected identity.

### V2 Roles And Permissions Foundation

Create one maintained permissions matrix before adding major V2 features. It
must be used by both the UI and RLS design; hiding a control in the UI is not a
security boundary.

Initial role direction:

- `platform_owner`: Derek-only global role. Can create and configure facilities.
  Cross-facility member-data access should remain intentional and should move
  toward an explicit support mode rather than an accidental universal bypass.
- `admin`: facility-scoped role. A facility admin can perform coaching work and
  broadly manage that facility, including coaches, members, groups, settings,
  and facility content.
- `coach`: facility-scoped role. Can manage approved coaching workflows in the
  facilities where the coach has an active membership, but does not receive
  platform-wide access.
- `athlete` / `h2k_member`: current member-facing facility roles. V2 may later
  separate access role from configurable member type if the schema audit shows
  that is safer and clearer.
- `parent`: future role with no V2 access until parent visibility rules and RLS
  are intentionally implemented.

Membership status direction:

- Keep pending approval for new signups.
- Keep approved/active access separate from role.
- Deactivation preserves history and blocks normal access.
- Reactivation restores the existing membership and history.
- Rejection does not grant facility access.

The permissions matrix must explicitly cover view, create, edit, delete,
archive, approve, role-management, and facility-settings actions for every
module before that module is production-ready.

### V2 Modifications Needed

Facility config:

- Add or prepare for a facility settings layer that controls logo, colors, display name, enabled modules, and member terminology.
- Decide which config belongs in the existing `facilities` table and which config needs a new table later.
- Keep the first version simple enough that Derek can manually configure a facility in Supabase if needed.

Module config:

- Treat workouts, habits, goals, leaderboards, announcements, progress, scheduling, and payments as modules that can eventually be enabled or disabled by facility.
- Make H2K habits optional and member-type-aware.
- Avoid showing modules to members whose facility or member type does not use them.

Branding/UI:

- Replace hardcoded Rip City labels where they should be facility labels.
- Keep Rip City visual style as the current design inspiration, but make colors/logo configurable over time.
- Avoid building future pages that assume every facility is baseball-only or H2K-only.
- Keep facility branding separate from core layout structure.

Signup/invites:

- Preserve the current V1 experience where a coach copies an Athlete, H2K, or
  general signup link and sends it to prospective members.
- Copied signup links may be shared; accepting or using one must never bypass
  the existing pending approval step.
- Ensure signup can route users into the correct facility, member type, and default groups.
- Keep future support for facility-specific signup questions, such as sport, position, age group, or program.
- Do not require email-bound, single-use invitations in V2 unless this product
  decision is intentionally revisited.
- The existing `facility_invites` table is not used by the current copied-link
  flow. Its live status and intended future use must be resolved during the SQL
  audit before new invite behavior is built on it.

Facility time and date rules:

- Every facility has one authoritative IANA time zone.
- Rip City's time zone is `America/New_York`.
- Store event timestamps in UTC, but calculate facility days, workout dates,
  habit days, Monday-Sunday weeks, streaks, announcement visibility, and
  leaderboard periods using the facility time zone.
- Audit current browser-local date calculations before changing them. V1
  currently protects local calendar dates from `toISOString()` rollover, but it
  does not yet use a facility time-zone setting.

Lifecycle rules:

- Deactivate coaches and members rather than deleting their identity or history.
- Archive facilities and groups instead of deleting them once they have history.
- Allow coaches to delete unused/draft workouts.
- Prefer archiving a workout that has assignments or member logs so it leaves
  normal UI without destroying history. If permanent deletion remains
  available, require a clear warning about all cascading data removal.
- Keep the existing goal and coach-note deletion decisions unless intentionally
  revised for a later audit requirement.
- Each major table must receive an explicit delete, archive, deactivate, and
  retention rule during the schema audit.

Data/security:

- Keep every new table facility-aware where the data belongs to a facility.
- Keep RLS policies facility-scoped before any new feature becomes production-ready.
- Avoid cross-facility queries unless they are only for Derek/global admin.
- Test every new V2 feature with at least two facilities in staging before production.

Developer workflow:

- Use staging Supabase to create fake second facilities and test customization.
- Add comments around code paths where facility config changes what the user sees.
- Track any remaining hardcoded Rip City assumptions during the cleanup pass.

### Done Criteria

- A second facility can exist in staging without seeing Rip City data.
- The app can show different facility names/logos/colors from config, even if setup is still manual.
- H2K-specific modules do not leak into facilities/member types that should not see them.
- New V2 features are designed as shared platform modules unless intentionally marked facility-specific.
- The roles/permissions matrix is documented and matches tested RLS behavior.
- Facility-local dates remain correct for users whose device time zone differs
  from the facility time zone and across daylight-saving changes.
- Deactivated users can be reactivated without losing their historical relationships.

---

## 2. Goals

### Product Purpose

Goals should let members and coaches define what each athlete or H2K member is
working toward. Goals should be flexible enough for strength, habits, sport,
school, accountability, body weight, or any custom development target.

### Decisions

- Members can create their own goals.
- Coaches can create goals for members in their own facility.
- Coaches can see goals created by members in their facility.
- Members can only see their own goals.
- Members and coaches can both mark a goal complete.
- Coaches and members can delete goals, but the UI must require confirmation.
- Members can fully edit goals they created for themselves.
- Members can only update status on coach-created goals.
- Members can only delete goals they created themselves.
- Coaches can delete any goal for a member in their facility.
- Delete is a true delete in V2.
- Goals should not require a sport/performance category yet.
- Goals should use a timeline field instead of a strict category:
  - Short term
  - Medium term
  - Long term
  - Ongoing
- Goal completion is manual in V2.
- Future automation can mark goals complete from workout logs, progress metrics,
  habit scores, body weight, or sport-specific stats.

### Goal Fields

- Name
- Description
- Timeline
- Current value
- Target value
- Unit
- Due date
- Status: active, completed, paused
- Assigned member
- Created by
- Created date
- Updated date
- Completed date

### Recommended Migration

The existing `goals` table already includes:

- `member_profile_id`
- `created_by`
- `source`
- `name`
- `description`
- `current_value`
- `target_value`
- `unit`
- `status`
- `visibility`
- `created_at`
- `updated_at`

Add:

- `timeline text not null default 'short_term'`
- `due_date date`
- `completed_at timestamptz`

Recommended timeline values:

- `short_term`
- `medium_term`
- `long_term`
- `ongoing`

### First UI Version

Member side:

- Add a Goals section to the member dashboard.
- Members can create a goal.
- Members can edit their own goals.
- Members can update status on coach-created goals.
- Members can mark goals active, completed, or paused.
- Show active goals first.
- Show completed goals as collapsed achievements/history so the page does not
  become long or bulky.

Coach side:

- Add a coach member detail view.
- Coaches search/select a member.
- Member detail shows profile, groups, H2K band if relevant, goals, history,
  progress, and notes.
- Coaches can create, edit, pause, or complete goals for that selected member.
- Coaches can delete goals after confirming.

### Open Questions

- None for V2.

---

## 3. Leaderboards

### Product Purpose

Leaderboards should make consistency and progress visible without turning the
platform into something negative or overly competitive.

### Decisions To Make

### Decisions

- Coaches can see leaderboards for members in their own facility only.
- Members can see leaderboards for their own facility only.
- Member-facing leaderboards should show only the top 5.
- Member-facing leaderboards should not show the bottom of the list.
- H2K and athlete leaderboards should be completely split for members.
- H2K members should not see athlete leaderboards.
- Athletes should not see H2K leaderboards.
- Coaches can see both H2K and athlete leaderboards for their facility.
- Leaderboards should focus on positive consistency and achievement metrics.
- Sensitive data should not be member-visible in V2.
- Members cannot opt out of leaderboards.
- If a member is not in the top 5, they should still be able to see their own
  rank separately.
- Time ranges should depend on the leaderboard metric.
- H2K habit leaderboards should support weekly, monthly, and all-time views.
- H2K band-level leaderboards should be considered.
- H2K band recognition means featuring members with the highest band levels,
  such as Red Band first, then Black, Blue, Green, Grey, White, and No Band.
- Tied scores share the same rank.
- Member-facing leaderboard rows should show profile picture and full name.
- Members with no score should not appear in the top 5.
- If a member has no score and views their own rank, show "No score yet" instead
  of ranking them last.
- Coaches can filter leaderboards by group.
- Members can see facility top 5 and their own group top 5 for safe metrics.
- Weekly leaderboards use Monday through Sunday.
- Monthly leaderboards use the calendar month.
- All-time leaderboards use all saved records.
- H2K streaks count consecutive days with at least 4 checked behaviors.
- Athlete streaks count consecutive assigned workout days completed.
- Longest streak should be a leaderboard metric.
- Current streak and longest streak should eventually appear on member profiles.
- Lifting max leaderboards should wait until estimated max calculations are
  designed from reps and weight logs.
- Athlete leaderboards can later include sport-specific attributes such as exit
  velocity, arm velocity, and other approved sport metrics.

### Decisions Still Needed

- Exact leaderboard metrics for V2.
- Which leaderboards are member-visible vs coach-only.
- Which leaderboards use weekly, monthly, all-time, or rolling time windows.

### Possible V2 Leaderboards

- H2K weekly habit score
- H2K monthly habit score
- H2K all-time habit score
- H2K highest band recognition
- Workout completion percentage
- Sets logged
- Goals completed
- Longest streak
- Current streak
- Group consistency
- Rolling 4-week H2K average
- Lifting estimated maxes later
- Sport-specific athlete metrics later

### Early Recommendation

Start with top-5 member-visible leaderboards for safe metrics and a fuller
coach leaderboard dashboard with filters.

---

## 4. Progress Tracking

### Product Purpose

Progress tracking should show how each member is improving over time. It should
eventually connect workouts, goals, profile metrics, and sport-specific data.

### V2 Status

Progress tracking is intentionally on hold for now because it is too broad to
build well without more product decisions.

Goals define what a member is trying to reach. Progress is the history and
numbers that show whether the member is moving toward those goals. In V2, use
existing history views and goal updates first, then decide which progress
metrics deserve a dedicated module.

### Decisions To Make

- Which metrics should be tracked manually first?
- Can members create progress entries, or only coaches?
- Should workout logs automatically create best-set/progress records?
- Which metrics are shared across all members?
- Which metrics are athlete-only or H2K-only?

### Possible V2 Progress Metrics

- Body weight
- Best set by exercise
- Estimated max
- Workout completion consistency
- H2K weekly score
- Coach-entered custom metric
- Sport-specific metrics later

### Early Recommendation

Start with simple manual progress entries plus workout-derived summaries. Avoid
official calculated maxes until the formula and coaching language are approved.

---

## 5. Coach Announcements And Notes

### Product Purpose

Coach announcements and notes should let coaches communicate important updates
to members while also tracking private context, follow-ups, concerns, reminders,
and development observations.

### Coach Notes Decisions

- Coach notes are private/internal.
- Members cannot see coach notes.
- Parents cannot see coach notes.
- All coaches/admins in the same facility can read notes.
- Notes are primarily attached to a specific member in V2.
- Notes should show newest first.
- Delete should require confirmation.
- Coaches can only edit/delete notes they created.
- Admins can manage notes in their facility.

### Coach Announcements Decisions

- Announcements are visible to members.
- Announcements should show who they are from.
- Members can close/dismiss announcements after reading them.
- Coaches/admins can create announcements for their own facility.
- Announcement targets:
  - Full facility
  - Member group
  - Specific member
- Coaches cannot edit each other's announcements.
- Admins can manage announcements in their facility.
- Announcements should support expiration dates so old messages do not stay
  visible forever.
- Announcements show on the member dashboard only in V2.
- If a member dismissed an announcement and the coach later updates it, the
  announcement should reappear for that member.
- Coaches need editable coach profiles with name and profile picture so
  announcements can show a real sender identity.

### Decisions To Make

- None for V2.

### Recommended Migration

Keep the existing `coach_notes` table for private coach-only notes.

Add a new `coach_announcements` table:

- `id`
- `facility_id`
- `created_by`
- `title`
- `body`
- `target_type`: facility, group, member
- `target_group_id`
- `target_member_profile_id`
- `publish_date`
- `expires_at`
- `created_at`
- `updated_at`

Add a new `coach_announcement_dismissals` table:

- `id`
- `announcement_id`
- `member_profile_id`
- `dismissed_at`

This keeps announcement visibility and member dismissals separate from private
coach notes.

Coach profile work can likely reuse the existing `profiles` fields:

- `full_name`
- `username`
- `bio`
- `profile_picture_url`

If coaches need extra public-facing fields later, add them after the first
announcement version is tested.

### Early Recommendation

Start with private coach-only notes attached to a member, plus simple member
dashboard announcements with dismiss support.

---

## 6. Profile And Community

### Product Purpose

Profiles and community features should make Rip City feel personal and fun while
still staying coach-controlled and development-focused.

### Decisions To Make

- Can members view other member profiles?
- What profile fields are public to other members?
- Should badges/streaks be automatic, coach-awarded, or both?
- Should coach shoutouts appear on member dashboards?
- Should birthday alerts be coach-only or member-visible?

### Possible V2 Features

- Better profile cards
- Active goals on profile
- Completed goals as achievements
- Habit streaks
- Workout streaks
- Birthday alerts
- Coach shoutouts
- Group announcements

### Early Recommendation

Keep community controlled in V2:

- Profiles stay mostly private.
- Coaches can see full member detail.
- Members see their own achievements.
- Public/member-visible community features wait until Rip City approves the
  social rules.

---

## 7. Staging And Release Safety

Before larger V2 development, create a separate Supabase staging project so new
schema changes, RLS policies, seeded data, and risky workflow changes can be
tested without touching the live beta database.

### Product Purpose

The live V1 app is now being used by real coaches and members. V2 development
should not risk breaking the production Supabase project or polluting it with
test accounts, test workouts, or half-finished migrations.

### Decisions

- Create a second Supabase project for staging.
- Keep production and staging as separate databases.
- Keep production and staging auth users separate.
- Keep production and staging storage buckets separate.
- Use staging for V2 schema migrations before running anything on production.
- Use staging for test members, test coaches, fake workouts, fake goals, and
  destructive cleanup tests.
- Keep production connected to the deployed V1 site until a V2 release is ready.
- Do not run experimental SQL against production first.
- Staging uses entirely fake data, not copied or anonymized production member data.
- Only Derek creates new facilities in V2.
- The repository should be able to recreate the application database structure
  in a new Supabase project without relying on undocumented SQL Editor history.

### Production Schema And SQL Audit

Before reorganizing or removing any SQL, compare the repository with the live
production project using read-only inspection.

Status: completed read-only on 2026-08-08. See
`docs/SUPABASE_AUDIT_2026-08-08.md` for the verified live inventory, SQL-file
classification, grant/policy drift, backup status, and staging recommendations.
No production cleanup was performed during the audit.

Audit inventory:

- Public tables, columns, types, defaults, constraints, foreign keys, and indexes.
- Functions, triggers, views, enums, extensions, and generated behavior.
- RLS enablement, policies, grants, and storage policies.
- Storage buckets used by the app.
- Auth-dependent functions and signup assumptions.
- Objects in production that are missing from source control.
- SQL in source control that is historical, superseded, optional, unapplied, or
  unsafe to rerun.
- Application references to each table/column before declaring it unused.

Do not delete a production object only because the current UI does not visibly
use it. Check code, policies, functions, triggers, foreign keys, stored data,
and future product intent first. Any removal must be a reviewed V2 migration
tested on staging.

### Reproducible Supabase Setup

The target repository structure should clearly separate:

- Ordered schema migrations.
- Required platform/facility seed data.
- Fake staging/test seed data.
- Read-only diagnostics and verification queries.
- Archived experiments and one-time fixes that must not be rerun.
- A SQL README with exact fresh-project and upgrade instructions.

A clean rebuild must include schema objects, RLS, functions, triggers, indexes,
required storage buckets/policies, and required seed configuration. SQL alone
does not restore Auth users, uploaded storage objects, secrets, redirect URLs,
or every Supabase project setting, so recovery documentation must cover those
separately.

Maintain two distinct safety plans:

1. Recreate the platform structure in a new Supabase project.
2. Recover production data, Auth identities, and stored files from backups.

The first staging milestone is a clean project created from the repository,
seeded with at least two fake facilities and fake global admin, facility admin,
coach, athlete, H2K, pending, inactive, and cross-facility coach scenarios.

### Setup Direction

- Create a Supabase staging project. Completed 2026-08-16.
- Rebuild the audited current-production structure in staging from the
  repository-controlled baseline. Completed and fully verified 2026-08-16.
- Run seed data needed for Rip City, default groups, H2K habits, exercise
  library, and test users.
- Add staging URL and anon/publishable key to local development config.
- Add staging redirect URLs for local testing and any staging Netlify deploy.
- Keep production keys separate and clearly labeled.
- Add a simple environment switch plan before V2 code depends on staging.

### Recommended Naming

- Production Supabase: `rip-city-production`
- Staging Supabase: `rip-city-staging`
- Production Netlify: public beta URL
- Staging Netlify: private or unshared preview URL

### Release Rule

Every database change should go through this order:

1. Create migration file in the repo.
2. Run migration on staging.
3. Test coach, H2K member, athlete, and pending-user flows on staging.
4. Confirm RLS still blocks unauthorized access.
5. Only then run the approved migration on production.

### V2 Regression And Release Checklist

Create a repeatable checklist covering:

- Signup links, signup, login, logout, password reset, pending access, approval,
  rejection, deactivation, and reactivation.
- Platform-owner, facility-admin, coach, member, and cross-facility isolation.
- Facility, group, and member workout assignments and logged history.
- H2K visibility, habit logging, Monday-Sunday scoring, and date backfill.
- Workout creation, editing, deletion/archive behavior, session logging, and history.
- Facility branding, module visibility, and time-zone boundaries.
- Loading, empty, error, offline, and permission-denied states.
- Supported mobile and desktop layouts.
- Migration verification, backup confirmation, rollback/recovery instructions,
  and post-deploy smoke tests.

### Accessibility Standard

V2 features should include keyboard access, visible focus states, semantic form
labels, accessible dialogs, adequate touch targets, sufficient contrast, and
status communication that does not depend on color alone. Facility-configured
brand colors must be checked for readable contrast.

### Notification Direction

- V2 starts with in-app notifications only.
- Email and push notifications remain future options and may be pulled forward
  if scope and development capacity allow.
- Keep announcements as source content and notifications as per-user delivery/read state.
- Notification records should be facility-scoped and support recipient,
  notification type, related item/link, created time, and read time.

---

## 8. Beta Feedback Polish Queue

These are items that came from the first live beta feedback or from testing on
mobile. They should be cleaned up during V2, but they do not need to block the
current beta as long as the core workflow still works.

### H2K Habit Backfill

Current V1 behavior lets members move backward or forward by day and edit missed
habit logs. This solves the immediate problem, but the UI should be redesigned
for V2.

V2 direction:

- Keep Today's Score and Weekly Score tied to the real current day/current week.
- Let members edit a specific habit date without changing the dashboard stats.
- Replace the temporary Back / Forward / Today controls with a cleaner picker.
- Consider a compact mini-calendar, missed-day prompt, or "Log another day"
  drawer.
- Make the selected date obvious so members do not accidentally log the wrong
  day.
- Keep Monday through Sunday as the H2K training week.

### Member Mobile Dashboard

The member dashboard is usable on mobile, but V2 should make it feel more like a
native app.

V2 direction:

- Keep the bottom mobile nav.
- Consider splitting Dashboard, Training, Habits, History, and Profile into
  clearer page-level views.
- Reduce tall stacked cards where a compact row or summary will work better.
- Keep the desktop dashboard layout separate where it already feels good.
- Make the training calendar the main place to find today, past, and future
  workouts.

### Workout Session Mobile

The workout session works on mobile, but V2 should keep improving the live
training experience.

V2 direction:

- Keep the mobile bottom nav consistent with member dashboard/profile.
- Keep set progress clear through the step circles instead of extra saved-set
  sections.
- Auto-mark sets complete when the required actual result is entered, while
  still supporting completion-only exercises.
- Keep Previous / Save Set / Save & Next stable and easy to reach.
- Continue making target vs actual clearer on small screens.

---

## 9. Codebase Cleanup And Maintainability

Before V2 gets much larger, clean the project so it is easier for Derek, future teammates, and any outside help to understand and safely change.

### Product Purpose

The live beta was built quickly, and that was the right move. V2 should make the codebase easier to maintain before adding bigger systems like goals, leaderboards, announcements, and staging environments.

### Cleanup Goals

- Make the repo easier to understand when someone opens it for the first time.
- Reduce unused or duplicate code where it is safe to do so.
- Add comments around complicated data loading, Supabase queries, RLS-sensitive logic, workout assignment logic, habit scoring, and workout completion math and all other functions to make it easy to look back and see what the code does.
- Split files only when it clearly improves readability.
- Keep working production behavior intact while cleaning.
- Avoid cleanup-only rewrites that create huge risky diffs.

### SQL Folder Cleanup

Status: completed 2026-08-16 for the audited V1 baseline. Active ordered
migrations now live in `supabase/migrations/`; read-only diagnostics and labeled
historical archives remain under `sql/`. Continue this structure for V2.

- Audit every file in `sql/`.
- Identify which SQL files are active migrations, seed files, old experiments, or one-time troubleshooting scripts.
- Keep production/staging migrations clearly named and ordered.
- Move old or unused SQL into an archive folder if we still want the history.
- Add a short SQL README explaining what should be run, what should not be run, and which files are historical.
- Do not delete SQL history until production and staging are both confirmed.
- Never run SQL cleanup against production without an explicit checklist.

### Docs Folder Cleanup

- Audit `docs/` for old plans, duplicated notes, and outdated instructions.
- Keep `BUILD_PLAN.md`, `VERSION_2_PLAN.md`, beta launch notes, setup docs, and current testing checklists easy to find.
- Move older planning docs into `docs/old/` when they are no longer current.
- Add short summaries at the top of important docs so the purpose is obvious.
- Make the V2 plan the main roadmap while V2 is being built.

### JavaScript And CSS Cleanup

- Add concise comments to explain complex sections, not obvious one-line code.
- Split very large JavaScript files into helper modules where it makes future work safer.
- Look for repeated auth, facility-access, date, assignment, scoring, rendering, and Supabase-query logic that can be shared.
- Keep shared member platform behavior separate from H2K-only behavior.
- Keep coach-only features separate from member-facing features.
- Clean dead CSS selectors and old layout classes after confirming they are not used.
- Avoid broad reformatting until formatting rules are agreed on, so diffs stay reviewable.

### Suggested Cleanup Order

1. Repo inventory: list active pages, JS files, CSS sections, SQL files, and docs.
2. SQL audit: label active migrations vs archive/troubleshooting files.
3. Docs audit: consolidate the current roadmap and move old files aside.
4. Code comments: explain complex Supabase and workflow logic.
5. Small dead-code removal: remove clearly unused selectors/functions.
6. File splitting: only split large files after tests confirm behavior.
7. Add contributor notes for future Derek/Sam workflow.

### Done Criteria

- A new developer can understand the repo structure from the docs.
- SQL files are not confusing or dangerous to run accidentally.
- Main workflow files have comments around the hard parts.
- Large files are either split or clearly organized with section comments.
- Production behavior is unchanged after cleanup.

---

## Suggested V2 Build Order

1. Document the roles/permissions matrix, lifecycle rules, time-zone rules, and
   current signup-link behavior.
2. Perform a read-only production schema/SQL audit and classify every SQL file.
3. Create the staging Supabase project and reproducible release-safety workflow.
4. Rebuild staging from repository-controlled migrations and fake seed data;
   verify two-facility isolation and all important roles.
5. Complete the platform/multi-facility and module-configuration implementation audit.
6. Complete the codebase cleanup and maintainability pass.
7. Create the repeatable regression, accessibility, migration, and release checklist.
8. Finish the beta feedback polish queue that affects daily use.
9. Goals database migration and RLS updates.
10. Coach member detail foundation.
11. Member goals UI.
12. Coach goals UI inside member detail.
13. Leaderboard decisions and first coach-visible leaderboard.
14. Progress tracking decisions and first progress UI.
15. Coach notes and in-app notification foundation.
16. Profile/community upgrades once privacy rules are clear.
