# Rip City Version 2 Plan

Version 2 should build on the live beta by turning Rip City from a workout/habit
logger into a fuller athlete development platform.

Core V2 direction:

- Goals
- Leaderboards
- Progress tracking
- Coach notes
- Profile and community upgrades

Do not start coding these sections until the product rules below are filled in.

---

## 1. Goals

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

## 2. Leaderboards

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

## 3. Progress Tracking

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

## 4. Coach Announcements And Notes

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

## 5. Profile And Community

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

## 6. Staging And Release Safety

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

### Setup Direction

- Create a Supabase staging project.
- Run the current production schema migrations into staging.
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

---

## 7. Beta Feedback Polish Queue

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

## Suggested V2 Build Order

1. Create the staging Supabase project and release-safety workflow.
2. Finish the beta feedback polish queue that affects daily use.
3. Goals database migration and RLS updates.
4. Coach member detail foundation.
5. Member goals UI.
6. Coach goals UI inside member detail.
7. Leaderboard decisions and first coach-visible leaderboard.
8. Progress tracking decisions and first progress UI.
9. Coach notes inside member detail.
10. Profile/community upgrades once privacy rules are clear.
