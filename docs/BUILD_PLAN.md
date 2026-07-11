# Rip City MVP Build Plan

## Phase 1: Foundation

- Set up Supabase project
- Run database schema
- Add Rip City facility seed data
- Add default groups
- Add default H2K habits
- Set up authentication
- Create signup flow
- Require coach approval before access

## Phase 2: Coach/Admin

- Coach dashboard
- Pending approval page
- Approve/reject new users
- View roster
- Filter by Athlete or H2K
- Filter athletes by sport and age group
- See who missed habit tracking 3 days in a row
- See who missed exercise data 2 days in a row

## Phase 3: H2K

- H2K member dashboard
- Six-habit tracking system
- 42-point weekly score
- Rolling 4-week average
- Basic coach view of H2K scores

## Phase 4: Athletes

- Athlete profile page
- Coach-created goals
- Workout assignment
- Set-by-set exercise logging
- Progress tracking
- Coach notes

## Phase 5: AI Coach Assistant

- Daily coach summary
- Weekly coach summary
- Athletes needing attention
- AI-drafted coach notes
- Parent summaries later

## Phase 6: Parent Access

- Parent accounts
- Link parent to athlete
- Parent dashboard
- Weekly progress summaries

## Future Phase: Scheduling and Payments

- Facility schedule
- Practices and group sessions
- Private workout booking
- Session attendance
- Parent/member payment portal
- Membership payments
- Private lesson payments
- Camps/clinics payments
- Stripe integration


## Core Product Direction

The app should use one shared member platform that can work for athletes, H2K members, and future facility programs.

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
- Athlete: baseball-specific data later, arm care later, player card later

## Leaderboard Direction

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


## Profile and Community Direction

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