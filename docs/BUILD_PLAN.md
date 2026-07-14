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

Program-specific modules:
- H2K: habit tracking / 42-point weekly score
- Athlete: baseball-specific data later, arm care later, throwing program later, player card later

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
- Login flow
- Coach approval before access
- Coach/admin approval page
- Coach dashboard
- Member dashboard
- Editable profile page
- H2K habit tracking
- H2K daily score
- H2K weekly score
- Coach view of H2K scores
- Coach workout builder
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
- See H2K habit scores
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

H2K-specific:
- Six-habit tracking system
- 42-point weekly score
- Rolling 4-week average
- Training habit should eventually auto-complete when workout is completed

Athlete-specific later:
- Baseball metrics
- Arm care
- Throwing program
- Player card
- Recruiting/showcase data

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
- H2K weekly habit score
- H2K rolling 4-week average
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

1. Test and clean workout session UI
2. Fix coach workout builder startup if needed
3. Auto-complete Training habit when workout is fully logged
4. Add workout history
5. Add exercise library
6. Improve coach dashboard workout visibility
7. Add roster/filtering
8. Clean docs and README before coach walkthrough