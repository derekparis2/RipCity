# Rip City MVP Build Plan

## Product Direction

Rip City should be built as one shared member platform that can work for:
- Athletes
- H2K members
- Future facility programs
- Future facilities outside Rip City

The app should not be hardcoded as only a baseball app or only an H2K app.

Shared modules:
- Dashboard
- Profile
- Workouts
- Goals
- Progress
- Leaderboards
- Coach notes
- Schedule later
- Payments later

Rip City shared member module:
- Athletes and H2K members use the same habit tracking and 42-point weekly
  score in V2.

Program-specific fields and future modules:
- H2K retains band information; athletes retain sport, age-group, and position
  information.
- Athlete-specific baseball expansion is tracked in `VERSION_3_PLAN.md`.

Core rule:
If a feature can be used by other facilities, build it into the shared platform.
If a feature is only for Rip City baseball, build it as an optional program-specific module.

---

## Current Working Features

- Supabase project connected
- Database schema created
- Rip City facility seeded
- Default groups added
- Default H2K habits added
- Signup flow
- Versioned Terms and Privacy acceptance with an existing-account reacceptance gate
- Login flow
- Coach approval before access
- Coach/admin approval page
- Distinct pending, rejected, inactive, and unconnected account states
- Facility-admin coach invite, approval, deactivation, and reactivation
- Coach dashboard
- Member dashboard
- Editable profile page
- Shared athlete/H2K habit tracking
- Shared daily and weekly habit scores
- Coach view of member habit scores
- Coach workout builder
- Separate coach Athlete and H2K habit leaderboards
- Member Top 5 and own-rank leaderboard work in progress
- Workout blocks: Warmup, A Block, B Block, Finisher, etc.
- Group/date workout assignment
- Member can see today’s assigned workout
- Member can open workout session
- Workout blocks display by rounds/supersets
- Set-by-set workout logging
- Save Set
- Save All Sets
- Actual weight/reps/time/distance/band data saves to Supabase

---

## Phase 1: Foundation

- Set up Supabase project
- Run database schema
- Add Rip City facility seed data
- Add default groups
- Add default H2K habits
- Set up authentication
- Create signup flow
- Require coach approval before access

Status: mostly complete.

---

## Phase 2: Coach/Admin

- Coach dashboard
- Pending approval page
- Approve/reject new users
- View roster
- Filter by Athlete or H2K
- Filter athletes by sport and age group
- See shared athlete/H2K habit scores
- See workout completion
- See who missed habit tracking 3 days in a row
- See who missed exercise data 2 days in a row
- Create workouts
- Assign workouts to groups, members, or facility
- Edit/delete workouts later

---

## Phase 3: Member Dashboard

The member dashboard should be shared by H2K members, athletes, and future program types.

Shared dashboard modules:
- Today’s workout
- Profile
- Workouts
- Goals
- Progress
- Leaderboards
- Coach notes
- Community/streaks/badges later

Rip City athlete and H2K shared module:
- Six-habit tracking system
- 42-point weekly score
- Rolling 4-week average
- Training habit should eventually auto-complete when workout is completed

Future facility-level habit-module configuration is tracked in
`VERSION_3_PLAN.md`.

---

## Phase 4: Workouts

Workout system direction:

Coach side:
- Coach creates workout
- Coach organizes exercises into blocks
- Blocks can be Warmup, A Block, B Block, C Block, Finisher, etc.
- Coach selects input type per exercise:
  - Completion
  - Weight + Reps
  - Band Color
  - Time
  - Distance
  - Custom
- Coach assigns workout to a date
- Coach assigns workout to a group, individual member, or facility
- Multiple coaches in the same facility can assign authorized workouts, and
  member/coach views show both the workout creator and assigning coach

Member side:
- Member sees today’s scheduled workout
- Member opens workout session
- Workout displays by rounds/supersets
- Member logs actual results
- Actual results are saved for history and future calculations

Future workout features:
- Exercise library
- Coach chooses exercises from a saved list
- Exercise defaults can include input type, description, video, and category
- Coach only changes sets, reps, tempo, rest, and notes
- Workout templates
- Recurring workout schedules
- Workout history
- Estimated max calculations
- Volume tracking
- PR tracking
- Coach completion dashboard

Testing/progress direction:
- Coach/admin-created Testing Days with reusable or custom ordered tests
- Multi-group and individual participant selection with a deduplicated roster snapshot
- Assigned Testing Day schedules on member Training
- Coach/admin roster-style result entry by athlete or by test
- Explicit absent/not-tested outcomes, guarded completion, and member-own result visibility
- Searchable, collapsible staff archives with completed-result review, correction,
  and per-test ranking when a ranking direction is defined
- Date-ordered, searchable member history below a Training calendar that marks
  assigned Testing Days
- Testing results connected to progress history and approved leaderboard metrics
- Exact recurring tests, multiple-attempt behavior, and ranking rules pending Rip City feedback

Coach onboarding direction:
- Platform owner creates the facility and first facility admin
- Facility admins invite/create or approve additional coaches
- Ordinary coaches cannot grant coach/admin access
- Coach links or requests remain pending until facility-admin approval

---

## Phase 5: Goals and Progress

- Coach-created goals
- Member-created goals if allowed
- Goal status: active, complete, paused
- Goal visibility: private, team, public
- Progress tracking
- Strength metrics
- H2K progress
- Athlete performance metrics later
- History charts later

---

## Phase 6: Leaderboards

Leaderboards should be shared across the whole platform and filterable by:
- Facility-wide
- Program/member type
- Group
- Specific metric

Examples:
- Athlete or H2K weekly habit score
- Athlete or H2K rolling 4-week habit average
- Workout completion
- Goals completed
- Strength/performance metrics later
- PRs later
- Consistency/streaks later

---

## Phase 7: Profile and Community

Each member should have a profile page that helps make the app feel personal, social, and fun.

Profile fields:
- Display name / username
- Profile picture
- Bio
- Birthday
- Sport
- Position
- School
- Graduation year
- Height / weight if needed
- Training goals
- Group/team
- Badges
- Streaks
- Recent progress

Community features:
- Birthday alerts
- PR alerts
- Goal completion posts
- Habit streaks
- Workout streaks
- Coach shoutouts
- Weekly leaderboard highlights
- Group announcements
- Badges and milestones

Goal:
Make the app feel like a Rip City community platform, not just a workout tracker.

---

## Phase 8: AI Coach Assistant

- Daily coach summary
- Weekly coach summary
- Athletes/members needing attention
- Missed habit alerts
- Missed workout alerts
- AI-drafted coach notes
- Weekly parent summaries later
- Workout/history insights later

---

## Phase 9: Parent Access

- Parent accounts
- Link parent to athlete/member
- Parent dashboard
- Weekly progress summaries
- Coach-approved visibility
- Payment access later

---

## Future Phase: Scheduling and Payments

Scheduling:
- Facility schedule
- Practices and group sessions
- Private workout booking
- Session attendance
- Camps/clinics
- Team training sessions

Payments:
- Parent/member payment portal
- Membership payments
- Private lesson payments
- Camps/clinics payments
- Stripe integration

---

## Near-Term Priorities

V2 is complete. Use `docs/VERSION_3_PLAN.md` for new feature sequencing and
keep production fixes small, reviewed, and based on the latest `main`.
