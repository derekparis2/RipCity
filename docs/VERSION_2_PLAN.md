# Rip City Version 2 Plan

For the ordered implementation queue and current work status, see
`docs/V2_BACKLOG.md`. This document remains the source of truth for detailed
product decisions and feature requirements.

Version 2 should build on the live beta by turning Rip City from a workout/habit
logger into a fuller athlete development platform with facility-isolated data
and one active facility per account.

Core V2 direction:

- Facility isolation and Rip City release readiness
- Goals
- Leaderboards
- Progress tracking
- Coach notes
- Profile and community upgrades

### Version Boundary

Version 2 is intended to stabilize the broad platform foundation and finalize
the core workout creation, editing, assignment, logging, and history experience.
"Finalize" means the workflow and data model are stable enough to build on;
normal fixes and intentional improvements may still follow.

Work intentionally deferred beyond this boundary belongs in
[`VERSION_3_PLAN.md`](VERSION_3_PLAN.md). V2 should avoid reopening its platform
and workout foundations solely to pull forward V3 scope.

Do not start coding these sections until the product rules below are filled in.

---

## 1. Platform Foundation And Facility Isolation

### Product Purpose

Rip City is the first beta facility, not the full identity of the product. The product should become a facility-configurable coaching platform that can support many gyms, academies, teams, and training programs without rebuilding the app for each one.

The long-term goal is for a facility to choose its modules, colors, logo,
groups, member types, and terminology with little or no custom code work from
Derek. That configurable multi-facility product is V3 scope. V2 proves the
shared foundation through Rip City while keeping facility data isolated.

### Decisions

- Rip City stays the beta/proof facility.
- New shared features should avoid data-model choices that prevent future
  facility reuse, but V2 does not need a general facility-settings interface.
- Facility-specific modules and self-service configuration are defined in the
  V3 plan.
- Rip City athletes and H2K members share the daily habit module in V2. Whether
  another facility enables habits remains future facility configuration.
- Facility coaches/admins should only manage their own facility.
- Members should only see their own facility experience.
- Rip City branding may remain the V2 release experience. Data-driven branding
  and terminology move to V3.
- V2 should avoid choices that block future self-service setup without building
  that setup prematurely.
- V2 product flows use one active facility membership per account. The existing
  second-facility and cross-facility staging rows remain isolation fixtures,
  not supported product UI.
- Reactivating a membership should restore its historical facility, group,
  workout, goal, and other authorized relationships rather than create a new
  disconnected identity.

### V2 Roles And Permissions Foundation

Create one maintained permissions matrix before adding major V2 features. It
must be used by both the UI and RLS design; hiding a control in the UI is not a
security boundary.

The maintained matrix is `docs/PERMISSIONS_MATRIX.md`. It records both the V2
access contract and known gaps in the verified staging baseline.

V2 role direction:

- `admin`: facility-scoped role. A facility admin can perform coaching work and
  broadly manage that facility, including coaches, members, groups, settings,
  and facility content.
- `coach`: facility-scoped role. Can manage approved coaching workflows in the
  facility where the coach has an active membership, but does not receive
  platform-wide access.
- `athlete` / `h2k_member`: current member-facing facility roles. V2 may later
  separate access role from configurable member type if the schema audit shows
  that is safer and clearer.
- `parent`: future role with no V2 access until parent visibility rules and RLS
  are intentionally implemented.

V2 must not create broad cross-facility RLS bypasses. See the V3 plan for future
platform operations.

Membership status direction:

- Keep pending approval for new signups.
- Keep approved/active access separate from role.
- Deactivation preserves history and blocks normal access.
- Reactivation restores the existing membership and history.
- Rejection does not grant facility access.

Coach onboarding direction:

- The platform owner creates a facility and establishes its first facility
  owner/admin.
- A facility admin must be able to create or invite additional coach accounts,
  or at minimum approve a pending coach signup and assign the coach role.
- Ordinary coaches can review pending member signups but cannot approve,
  reject, deactivate, or reactivate any account. Facility admins make every
  member and coach lifecycle decision in V2.
- Athlete and H2K signup do not include group selection. During approval, a
  facility admin must choose the member's initial matching same-facility group.
  The group assignment and approval are one atomic database action, and pending
  members cannot assign themselves to a group.
- Coach signup must remain facility-scoped and pending until a facility admin
  approves it. A copied or forwarded link must never grant coach access by
  itself.
- The approval screen must clearly distinguish prospective coaches from
  athletes and H2K members so an elevated role is never approved accidentally.
- Every coach/admin creation, approval, role change, deactivation, and
  reactivation must be enforced by RLS and covered by two-facility staging
  tests; hiding elevated controls in the browser is not sufficient.

The permissions matrix must explicitly cover view, create, edit, delete,
archive, approve, role-management, and facility-settings actions for every
module before that module is production-ready.

### V2 Configuration Boundary

- Do not build self-service facility settings, branding, terminology, or module
  switches in V2.
- Keep Rip City as the only real V2 facility experience; Test Facility Alpha is
  a staging isolation fixture, not a second supported launch.
- Keep Rip City's shared member habits facility-scoped; athlete and H2K members
  both receive the same habit navigation, logging, weekly score, and history.
- Preserve facility IDs and facility-scoped RLS so V3 can add real
  configuration without rebuilding V2 data.
- Track the complete configuration system in
  [`VERSION_3_PLAN.md`](VERSION_3_PLAN.md#facility-configuration-and-module-visibility).

### Universal And Facility Exercise Library

The exercise builder should present one combined exercise library. Coaches
should not have to understand or navigate separate "universal" and "facility"
lists.

Decisions:

- Derek manages the universal exercise catalog through the approved manual V2
  process.
- Every facility can view and use universal exercises.
- Coaches can add exercises that belong only to their facility; other
  facilities must never see them.
- When a coach edits a universal exercise, the app automatically creates or
  updates a facility-specific override. The universal row remains unchanged,
  and that facility sees only its customized version in the combined list.
- When a coach deletes a universal exercise, the app hides it only for that
  facility. It must not delete or modify the universal exercise for anyone
  else.
- Universal updates flow through to facilities that have not overridden or
  hidden that exercise. Existing facility overrides remain unchanged.
- A future "Reset to universal" action may remove the facility override/hide
  record and restore the current universal version.
- Existing workouts and logged history must remain stable when a catalog entry
  is overridden, hidden, archived, or updated.
- The Workout Builder remains the primary place to choose exercises through
  inline search. Full exercise-library management lives on a separate coach
  page linked only from the builder, not in the main coach navigation.
- The builder should use its side space for a compact workout outline instead
  of a second exercise picker.

Recommended data direction:

- Continue using one `exercise_templates` system so workouts can reference
  universal and facility exercises consistently.
- Universal templates have no facility owner and can be changed only through
  Derek's trusted manual V2 process.
- Facility-created templates have a facility owner and no universal source.
- Facility overrides reference their universal source. An active override
  supplies the facility version; an inactive override acts as a facility-only
  hide record.
- Enforce at most one override per facility/universal-template pair.
- Build a facility-scoped merged catalog query that returns facility-created
  exercises, active facility overrides, and only the universal exercises that
  have not been overridden or hidden.
- Perform edit-to-override and delete-to-hide operations transactionally so a
  failed copy cannot leave the catalog in an ambiguous state.
- RLS must allow facilities to read universal rows plus their own facility
  rows, while preventing facility coaches from changing universal rows or any
  other facility's rows.

Current-data transition direction:

- The 88 repository starter exercises are candidates for the universal catalog.
- Maintain the working classification review in
  [`EXERCISE_INPUT_AUDIT.md`](EXERCISE_INPUT_AUDIT.md); its recommendations do
  not change staging data until Derek and the Rip City coach approve them.
- The six verified coach-created production exercises remain Rip City-specific.
- Rip City's edited `Push-Up` and `Tempo Push-Up` values become facility
  overrides if those production changes are confirmed as intentional.
- Audit the starter exercise defaults before promoting them to the universal
  catalog. Their prescribed workout target and their member-entered result must
  be treated as separate concepts where needed:
  - Band exercises require actual reps; band color is optional facility context.
  - Prescribed-distance drills such as A-skips should let the coach set the
    distance while the member only marks the exercise complete.
  - Measured-distance exercises such as broad jumps should keep member distance
    entry. A saved result of `0` means completed but not measured and must count
    as a valid completed result rather than missing data.
  - Vertical Jump should be added to the universal starter catalog as a
    measured-distance exercise.
  - Medicine-ball exercises use weight and reps so members record the ball
    weight rather than throwing distance; unilateral throws such as Med Ball
    Shot Put default to `Each Side`.
- Exercises may be marked `Each Side` in the library and overridden within an
  individual workout. For example, `8 reps each side` means eight right and
  eight left. Members record one weight and one rep result per set in V2; the
  app does not create separate right-side and left-side log fields.
- Test the transition entirely in staging before preparing a production
  migration.

Done criteria:

- Coaches see one exercise list without separate universal/facility sections.
- Adding an exercise affects only the coach's facility.
- Editing a universal exercise changes only that facility's visible version.
- Deleting a universal exercise hides it only for that facility.
- A second facility continues seeing the original universal exercise.
- Cross-facility RLS tests prove that facility-created exercises and overrides
  never leak.

#### Branding/UI

- Keep Rip City branding for the V2 release.
- Avoid making shared data structures baseball-only or H2K-only.
- Keep coach/admin layout structure separable from branding so V3 can introduce
  configurable facility identity without rebuilding those pages.

#### Signup/Invites

- Preserve the current V1 experience where a coach copies an Athlete, H2K, or
  general signup link and sends it to prospective members.
- Athlete, H2K, and general member signup links remain reusable so a facility
  can send one link in a group email. Accepting one must never bypass the
  existing pending approval step.
- Coach signup uses a separate facility-admin-only invitation. Each coach link
  expires after seven days, can be claimed once, and creates only a pending
  coach membership. An admin in that same facility must approve the request
  before coaching access is granted.
- Ordinary coaches cannot create coach invitations or approve coach/admin
  memberships.
- Ensure signup can route users into the correct facility, member type, and default groups.
- Keep future support for facility-specific signup questions, such as sport, position, age group, or program.
- Coach invitations are not email-bound in V2; the single-use code is the
  credential and should be sent only to the intended coach.
- The `facility_invites` table powers secure coach onboarding only. Reusable
  member signup links continue using the existing query-parameter flow.

#### Facility Time And Date Rules

- Rip City's time zone is `America/New_York`.
- Store event timestamps in UTC and keep Rip City calendar behavior correct for
  workouts, habits, Monday-Sunday weeks, streaks, and leaderboard periods.
- A generalized per-facility time-zone layer and facility-local date helpers are
  V3 configuration work.

#### Lifecycle Rules

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

#### Data/Security

- Keep every new table facility-aware where the data belongs to a facility.
- Keep RLS policies facility-scoped before any new feature becomes production-ready.
- Avoid cross-facility queries unless they are only for Derek/global admin.
- Test every new V2 feature with at least two facilities in staging before production.

#### Developer Workflow

- Use the fake second staging facility to test isolation, not V2 customization.
- Track hardcoded Rip City assumptions that must be revisited before onboarding
  another real facility in V3.

### Done Criteria

- A second facility can exist in staging without seeing Rip City data.
- H2K-only profile fields such as band color do not appear for Rip City
  athletes; the V2 habit module is intentionally shared by both programs.
- New V2 features are designed as shared platform modules unless intentionally marked facility-specific.
- The roles/permissions matrix is documented and matches tested RLS behavior.
- Rip City workout, habit, streak, and leaderboard dates behave correctly in
  `America/New_York`.
- Deactivated users can be reactivated without losing their historical relationships.
- Pending, rejected, inactive, and unconnected accounts receive distinct,
  accurate blocked-access messages.
- Facility admins can deactivate/reactivate coaches by updating the existing
  membership; ordinary coaches cannot manage coach access.
- Facility admins can manage all own-facility groups. Ordinary coaches can
  delete groups or remove existing group members only from groups they created;
  seeded/legacy groups without an owner are admin-managed.

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
- Starting value (stored in `current_value`)
- Target value
- Unit
- Due date
- Status: active, completed, paused
- Assigned member
- Created by
- Created date
- Updated date
- Completed date

V2 display rule: the stored `current_value` is the starting value. The latest
goal check-in is the active current value, or the finish value after completion.
Member and coach views should show Start, Current/Finish, and Target together.

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

- Give Goals its own member page linked from the shared member navigation.
- Members can create a goal.
- Members can edit their own goals.
- Members can update status on coach-created goals.
- Members can mark goals active, completed, or paused.
- Show active goals first.
- Show paused goals in their own collapsed section instead of mixing them into
  the active list.
- Show completed goals as collapsed achievements/history so the page does not
  become long or bulky.
- Keep goal status visible on collapsed summaries, and show the recorded
  goal date as a range from creation through the due date. For completed goals,
  end the range on the recorded completion date instead of treating the old due
  date as upcoming.

Coach side:

- Add a coach member detail view.
- Coaches search/select a member.
- Member detail shows profile, groups, H2K band if relevant, goals, history,
  progress, and notes.
- Coaches can create, edit, pause, or complete goals for that selected member.
- Coaches can delete goals after confirming.
- Keep coach goal cards collapsed by default, with active goals shown first and
  paused and completed goals grouped into their own collapsed sections.
- Keep the coach goal-assignment form collapsible so member history and existing
  goals remain easy to scan.

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
- Shared habit leaderboards may later support weekly, monthly, and all-time
  views for both H2K members and athletes.
- H2K band-level leaderboards should be considered.
- H2K band recognition means featuring members with the highest band levels,
  such as Red Band first, then Black, Blue, Green, Grey, White, and No Band.
- Tied scores share the same rank.
- Member-facing leaderboard rows should show profile picture and full name.
- Members with no score should not appear in the top 5.
- If a member has no score and views their own rank, show "No score yet" instead
  of ranking them last.
- Coaches can filter leaderboards by group.
- Coaches can choose the metric used to rank a leaderboard. The first coach
  version supports rolling averages, current-week results, and current/longest
  streaks; future lift and testing metrics should plug into the same selector.
- Members can see their own program's all-Athlete or all-H2K top 5 and their
  own group top 5 for safe metrics. They never see a combined facility board.
- Weekly leaderboards use Monday through Sunday.
- Monthly leaderboards use the calendar month.
- All-time leaderboards use all saved records.
- Habit streaks for both member programs count consecutive days with at least
  4 checked behaviors.
- Longest streak should be a leaderboard metric.
- Current streak and longest streak should eventually appear on member profiles.
- Lifting max leaderboards should wait until estimated max calculations are
  designed from reps and weight logs.
- Athlete leaderboards can later include sport-specific attributes such as exit
  velocity, arm velocity, and other approved sport metrics.

### Decisions Still Needed

- Which additional metrics should be promoted from coach-only to member-visible
  top-five boards after the member page split.
- Whether monthly and all-time views are still required for the V2 deadline or
  should follow the initial rolling-four-week release.

### Initial V2 Metrics Approved

- The coach experience starts with separate H2K and athlete tabs, facility and
  group scoping, member search, full lists, and competition ranking for ties.
- Both tabs rank their members by the same Rip City habit metrics: average
  weekly habit points across the previous four completed Monday-Sunday weeks,
  current-week score, current streak, and longest streak. The current partial
  week does not affect the rolling average.
- A streak day requires at least four distinct completed habits for either
  member program. The current day does not break a streak while it is still in
  progress.
- Assigned-workout completion remains available in the separate coach workout
  review and attention tools; it is not the athlete leaderboard score.
- Personal versions of these same metrics appear on the member dashboard using
  one shared calculation module.
- The coach dashboard is an action queue rather than a second leaderboard.
  Either member type needs habit attention after three consecutive completed
  calendar days without habit tracking. Athletes additionally need workout
  attention when their last two completed assigned-workout days both contain
  no exercise data. The current day does not count as missed while it is still
  in progress.
- Individual 12-week habit history belongs on the coach member-detail page,
  while assignment completion belongs in coach workout review.
- Future lift, speed, jump, and sport-testing results should extend the same
  selectable leaderboard metric registry after the Testing Day data model and
  member-visibility rules are approved. Do not build a second unrelated
  leaderboard implementation for testing results.

### Possible V2 Leaderboards

- Weekly habit score for either member program
- Monthly habit score for either member program
- All-time habit score for either member program
- H2K highest band recognition
- Workout completion percentage
- Sets logged
- Goals completed
- Longest streak
- Current streak
- Group consistency
- Rolling 4-week habit average for either member program
- Lifting estimated maxes later
- Sport-specific athlete metrics later

### Early Recommendation

Start with top-5 member-visible leaderboards for safe metrics and a fuller
coach leaderboard dashboard with filters.

Implementation is split into two deliverables. The completed coach leaderboard
branch owns the shared calculation layer, full coach boards, member personal
metrics, attention rules, and member-detail history. A separate member-facing
package will reuse that layer for the approved top-five and own-rank views after
the member page split, preventing coach and member calculations from drifting.

---

## 4. Progress Tracking

### Product Purpose

Progress tracking should show how each member is improving over time. It should
eventually connect workouts, goals, profile metrics, and sport-specific data.

### V2 Status

Broad progress tracking remains on hold because it is too large to build well
without more product decisions. The Testing Day scheduling foundation is now
in progress as a separate post-release feature.

Goals define what a member is trying to reach. Progress is the history and
numbers that show whether the member is moving toward those goals. In V2, use
existing history views and goal updates first, then decide which progress
metrics deserve a dedicated module.

### Testing Day Direction

Rip City approved a coach-run Testing Day workflow. The first delivery lets
coaches and facility admins define a set of tests and select any combination of
groups and individual participants. Who may enter official results is still an
open decision, so result writes remain disabled in this first delivery.

Testing Day should not be modeled as an ordinary workout. A durable design is
expected to include:

- A facility-scoped testing session with name, date, status, creator, and a
  snapshotted participant roster built from selected groups/members.
- Ordered test definitions with a name, unit, input type, and whether a higher
  or lower result ranks better.
- A result-ready table that can record the entering account, optional notes,
  and approved values once entry permissions are decided.
- A future roster-style entry screen so an entire testing group can be entered
  efficiently without opening every member separately.
- A clear connection to member progress history and the existing selectable
  leaderboard metric registry once visibility and ranking rules are approved.
- Facility-scoped RLS and two-facility tests so coaches can never enter or read
  another facility's testing data.

Already decided:

- Group and individual selection are both supported and are deduplicated into
  one snapshotted roster.

Decisions still required before result entry:

- Which tests are used regularly?
- Does each test store one result, multiple attempts, or only the best result?
- Are results entered only by coaches, or can members submit results for coach
  verification?
- Which results should members see, and which may appear on leaderboards?
- Do previous testing days need side-by-side comparison or charts in the first
  release?

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

The V2 slice lets coaches communicate important updates to targeted members.
Private note UI and a generalized notification system are deferred to V3.

### Coach Notes Future Decisions

- Coach notes are private/internal.
- Members cannot see coach notes.
- Parents cannot see coach notes.
- All coaches/admins in the same facility can read notes.
- Notes are primarily attached to a specific member when the V3 UI is built.
- Notes should show newest first.
- Delete should require confirmation.
- Coaches can only edit/delete notes they created.
- Admins can manage notes in their facility.

### Coach Announcements Decisions

- Announcements are visible to members.
- Announcements should show who they are from.
- Members can hide an announcement for the current day without changing what
  other members see.
- Coaches/admins can create announcements for their own facility.
- Announcement targets:
  - Full facility
  - All athletes, regardless of how many groups they belong to
  - All H2K members, regardless of how many groups they belong to
  - One or more member groups
  - One or more specific members
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

Add a facility-scoped `coach_announcements` table plus normalized group/member
recipient tables so one announcement can target multiple groups or members.
The announcement record includes:

- `id`
- `facility_id`
- `created_by`
- `title`
- `body`
- `importance` (`standard` or `important`)
- `audience_type`
- `publish_at`
- `expires_at`
- `created_at`

Member dismissal stores one private dismissal timestamp per announcement and
member. A dismissal removes the message from the main announcement area for the
current day, while a collapsed dashboard section and immediate Undo action let
the member restore it. An otherwise-active message reappears on the next local
calendar day.

The coach form defaults expiration to 24 hours, while allowing another future
time or no expiration. Important announcements sort above standard messages.
Expired messages disappear from member access, remain in a collapsed coach
history, and can be permanently cleared by their creator or a facility admin.

The `coach_announcement_dismissals` table includes:

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

Start with facility/group/member announcements on the member dashboard. Keep
private notes protected in the database, but defer their UI until the targeted
announcement workflow is stable.

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

### Possible V3 Features

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
seeded with at least two fake facilities and fake facility-admin, coach,
athlete, H2K, pending, and inactive scenarios. Cross-facility denial is tested
between the dedicated accounts for each facility.

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

Current web-preview status (2026-09-11):

- `https://ripcitystaging.netlify.app` deploys `v2-development` and successfully
  reaches the staging login flow on phone and desktop.
- Netlify Deploy Previews are enabled for pull requests targeting
  `v2-development`; each preview continues using the shared fake-data staging
  Supabase project.
- Staging Supabase Auth allows the stable staging URL, Netlify preview
  subdomains, and optional localhost port `3000`.
- The repeatable contributor workflow, migration checks, recovery guidance,
  accessibility checks, and post-deploy smoke tests are maintained in
  `docs/STAGING_RELEASE_CHECKLIST.md`.
- Environment-driven frontend configuration remains a production-release gate;
  V2 must not reach `main` while its frontend is hardcoded to staging.

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
- Facility-admin, coach, member, lifecycle-state, and cross-facility isolation.
- Facility, group, and member workout assignments and logged history.
- H2K visibility, habit logging, Monday-Sunday scoring, and date backfill.
- Workout creation, editing, deletion/archive behavior, session logging, and history.
- Rip City branding, member-type feature visibility, and date boundaries.
- Loading, empty, error, offline, and permission-denied states.
- Supported mobile and desktop layouts.
- Migration verification, backup confirmation, rollback/recovery instructions,
  and post-deploy smoke tests.

### Accessibility Standard

V2 features should include keyboard access, visible focus states, semantic form
labels, accessible dialogs, adequate touch targets, sufficient contrast, and
status communication that does not depend on color alone. Facility-configured
brand colors must be checked for readable contrast.

### Responsive UI Standard

Use the same responsive rules across new and refactored V2 screens:

- Prefer fluid sizing with `clamp()`, flexible grids, and readable maximum
  content widths instead of maintaining separate fixed phone and desktop
  designs.
- Keep normal page gutters proportional to the viewport, but prevent forms and
  logging interfaces from stretching across very large monitors.
- Use natural-height cards. Do not force a short card to match an unrelated
  taller card unless the comparison genuinely benefits from equal heights.
- Reflow multi-column content at the existing tablet and phone breakpoints;
  collapse or progressively disclose long content instead of shrinking text.
- Treat focused task flows such as active workout logging as single-viewport
  workspaces on phone and desktop. Keep the page itself fixed when normal
  content fits, but retain an internal overflow fallback for short screens,
  expanded optional content, accessibility zoom, and phone keyboards.
- Keep interactive touch targets at least 44 by 44 CSS pixels and preserve
  safe-area space around fixed mobile navigation and actions.
- Use color as a secondary orientation cue, never as the only status label.
  Workout blocks cycle through blue, orange, green, coral, and gold accents.
- Test important flows around 390px phone, 768px tablet, and 1440px desktop
  widths, plus keyboard focus and phone input-keyboard behavior.

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

### Shared Member Habit Backfill

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
- Keep Monday through Sunday as the shared Rip City habit week.

### Coach And Admin Responsive Navigation

- Keep Dashboard, Roster, Workout Builder, Leaderboards, and Approvals reachable
  from every coach/admin page through one shared navigation map.
- Use compact Menu and Log Out controls on smaller screens instead of stacking
  every destination into tall full-width header buttons.
- Keep contextual actions such as Back to Roster or Back to Workout Builder in
  page content rather than replacing the shared navigation.
- Put member signup links on Roster, with only the Athlete and H2K choices used
  by the current signup flow.
- Put pending signup decisions first on Approvals and progressively disclose
  facility-admin-only coach invite/access tools.
- Paginate or progressively reveal large roster and exercise-library results so
  ordinary phone tasks do not render the full dataset at once.

### Member Mobile Dashboard

The member dashboard is usable on mobile, but V2 should make it feel more like a
native app.

V2 direction:

- Keep the bottom mobile nav.
- Keep Dashboard in the central mobile-nav position and place Training directly
  to its left. Habits remains a shared destination for Rip City athletes and
  H2K members without changing this relationship.
- Use dedicated Dashboard, Training, Habits, History, Goals, and Profile views.
- Keep the dashboard focused on personal metrics, feedback, and concise links
  into those feature pages instead of rendering every workflow at once.
- Keep Habits visible to both approved Rip City athlete and H2K members across
  member pages and workout sessions.
- Reduce tall stacked cards where a compact row or summary will work better.
- Keep the desktop dashboard layout separate where it already feels good.
- Make the training calendar the main place to find today, past, and future
  workouts.

### Workout Session Mobile

The workout session works on mobile, but V2 should keep improving the live
training experience.

V2 direction:

- Keep the mobile bottom nav consistent across member dashboard, training,
  goals, profile, and workout-session views; all visible destinations must fit
  without wrapping or disappearing.
- Open on a block-based workout preview, then use named, color-coded block
  navigation instead of a long row of numbered global steps.
- Show exercise position and set position separately so progress labels never
  describe a set as a different exercise.
- Auto-mark sets complete when the required actual result is entered, while
  still supporting completion-only exercises.
- Keep Previous / Save Set / Save & Next stable and easy to reach above the
  mobile navigation without covering focused inputs.
- Fit a normal single-set logging flow inside one phone or desktop viewport;
  only the focused workout card should scroll as a safety fallback.
- Continue making target vs actual clearer on small screens.

### Workout Builder Editing And Version History

Coaches need to correct upcoming workouts without rewriting what members were
previously assigned or completed.

Decisions:

- An unassigned workout can be edited directly.
- A workout used only by future assignments can be edited directly, and those
  future assignments continue using the corrected workout.
- A past assignment must keep the workout structure and instructions that were
  originally assigned.
- Any assignment with member logs is treated as started history and must not be
  changed by later workout edits.
- A same-day assignment with no member logs may still be corrected.
- If a coach edits an upcoming or unstarted assignment whose saved workout also
  has past/started use, the app creates a new workout version and moves the
  selected upcoming assignment to it. The coach should experience this as a
  normal edit rather than having to manually duplicate and reconnect records.
- If the same workout has multiple upcoming assignments, the edit flow should
  clearly ask whether the change applies only to the selected assignment or to
  all unstarted future assignments.
- Creating a new version must preserve a visible connection to its source so
  coaches can understand the workout's history without mixing completed logs
  into the new version.
- Workout title/details, blocks, exercises, ordering, targets, and coaching
  instructions follow the same history-preservation rule.
- Draft/unused workouts may be permanently deleted. Workouts with assignments
  or logs should normally be archived, with destructive deletion unavailable
  from the ordinary coach UI.

Done criteria:

- Coaches can correct tomorrow's workout without manually rebuilding it.
- Editing an upcoming workout never changes a past workout or saved member log.
- Direct edits and automatic version creation are clear before the coach saves.
- Assignment dates and "past/today/future" decisions use the facility time zone.

### Multi-Coach Workout Assignment

- Any active coach/admin in a facility can assign an authorized workout in
  that facility, including a workout originally created by another facility
  coach.
- Preserve `workout_assignments.assigned_by` as the historical source of the
  assignment. Member workout cards, previews, and session details should show
  the assigning coach's display name, and coach review/history should expose
  the same attribution.
- Deactivating a coach must not remove the coach name from historical
  assignments. If an identity is genuinely unavailable, show a neutral
  fallback instead of breaking the workout query.
- Preserve `workouts.created_by` as the historical workout author and show the
  creator separately from the assigning coach. Members receive only authorized
  display names, not broader coach profile data.
- Prevent duplicate assignment of the same workout, target, and date even when
  two coaches act at nearly the same time; browser-only duplicate filtering is
  not enough for this race.
- Treat overlapping facility, group, and individual targets as one effective
  assignment per member for the same workout and date. Members in multiple
  selected groups must see and log one workout, and attendance/leaderboard
  calculations must count it once.
- Add staging coverage with two coaches in one facility plus a coach in the
  second facility. Both same-facility coaches may assign; the other-facility
  coach must be denied.

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
- Move useful completed version notes into `docs/archive/` and delete obsolete
  notes that Git history already preserves.
- Add short summaries at the top of important docs so the purpose is obvious.
- Make the V2 plan the main roadmap while V2 is being built.

### JavaScript And CSS Cleanup

- Add concise comments to explain complex sections, not obvious one-line code.
- Split very large JavaScript files into helper modules where it makes future work safer.
- After the major V2 feature branches are merged, split `css/styles.css` into
  clearly ordered shared, component, authentication, coach, and member
  stylesheets. Start as a mechanical move with no intentional visual changes.
- Preserve the existing cascade order during the stylesheet split, document
  which files each page loads, and visually regression-test every active page
  at desktop and mobile widths before removing the original combined file.
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
6. File splitting: only split large files after tests confirm behavior; perform
   the final stylesheet split after major V2 feature work to avoid unnecessary
   cross-branch merge conflicts.
7. Maintain the Derek/Sam contributor workflow in `CONTRIBUTING.md`.

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
5. Audit only the Rip City hardcoded assumptions that affect V2 correctness;
   record reusable facility configuration work in the V3 plan.
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
