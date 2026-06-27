# Hard to Kill Database Plan

This project is currently a front-end prototype that stores workout and habit checks in `localStorage`. The next version should move that data into a real database so an athlete and coach can track training over time.

## Main Goal

Build a database-backed version of Hard to Kill that can:

- Save athlete profiles
- Track daily workouts
- Track exercise completion
- Track daily habits
- Track personal goals
- Track progress numbers over time
- Let a coach view an athlete's consistency and progress

## Recommended Stack

For the next phase, the simplest strong option is:

- Frontend: current HTML, CSS, and JavaScript first
- Backend: Node.js with Express
- Database: Supabase PostgreSQL
- Auth: Supabase Auth or simple email/password login while learning

Supabase is a good fit because it gives you PostgreSQL, authentication, a dashboard for viewing data, and an API without needing to manage a server from scratch.

## Core Data Tables

### users

Stores login/account information for athletes and coaches.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| email | text | User email |
| full_name | text | Display name |
| role | text | `athlete` or `coach` |
| created_at | timestamp | Account creation date |

### athlete_profiles

Stores athlete-specific information.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| user_id | uuid | Connects to users |
| coach_id | uuid | Optional assigned coach |
| sport | text | Athlete sport |
| position | text | Optional |
| body_weight | numeric | Current body weight |
| created_at | timestamp | Profile creation date |

### workouts

Stores workout templates, such as Lower Body Power.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| title | text | Workout name |
| focus | text | Strength, speed, recovery, etc. |
| estimated_minutes | integer | Workout length |
| created_by | uuid | Coach or admin user |
| created_at | timestamp | Creation date |

### workout_exercises

Stores exercises inside each workout.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| workout_id | uuid | Connects to workouts |
| name | text | Exercise name |
| details | text | Sets, reps, distance, or notes |
| exercise_order | integer | Display order |

### workout_assignments

Stores which athlete should complete which workout on which day.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| athlete_id | uuid | Assigned athlete |
| workout_id | uuid | Assigned workout |
| assigned_date | date | Workout date |
| status | text | `open`, `in_progress`, or `complete` |

### exercise_completions

Stores whether each exercise was completed.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| assignment_id | uuid | Connects to workout_assignments |
| exercise_id | uuid | Connects to workout_exercises |
| completed | boolean | Completion status |
| completed_at | timestamp | When it was checked off |

### habits

Stores habit templates.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| name | text | Habit name |
| category | text | Hydration, nutrition, sleep, etc. |
| created_by | uuid | Coach or admin user |

### habit_assignments

Stores which habits apply to an athlete.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| athlete_id | uuid | Assigned athlete |
| habit_id | uuid | Assigned habit |
| active | boolean | Whether this habit is currently tracked |

### habit_completions

Stores daily habit completion.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| athlete_id | uuid | Athlete who completed it |
| habit_id | uuid | Completed habit |
| completion_date | date | Day completed |
| completed | boolean | Completion status |
| completed_at | timestamp | When it was checked off |

### goals

Stores athlete goals.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| athlete_id | uuid | Goal owner |
| name | text | Goal name |
| current_value | numeric | Current number |
| target_value | numeric | Target number |
| unit | text | lb, days, seconds, etc. |
| status | text | `active`, `complete`, or `paused` |
| created_at | timestamp | Creation date |

### progress_entries

Stores performance and body metrics over time.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| athlete_id | uuid | Athlete being tracked |
| metric_name | text | Body Weight, Trap Bar Deadlift, Sprint Time, etc. |
| value | numeric | Recorded value |
| unit | text | lb, sec, reps, etc. |
| recorded_date | date | Date recorded |
| notes | text | Optional context |

## First Backend Features

Build these in order:

1. Create database tables in Supabase.
2. Replace hard-coded workouts, habits, and goals with API-loaded data.
3. Save workout exercise checks to the database.
4. Save habit checks by date.
5. Add a real Add Goal form.
6. Add a coach dashboard that lists athletes and completion rates.

## Example API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard/:athleteId` | Load dashboard stats |
| GET | `/api/workouts/today/:athleteId` | Load today's workout |
| PATCH | `/api/exercises/:completionId` | Toggle exercise completion |
| GET | `/api/habits/:athleteId` | Load active habits |
| POST | `/api/habits/:habitId/complete` | Save daily habit completion |
| GET | `/api/goals/:athleteId` | Load athlete goals |
| POST | `/api/goals` | Create a goal |
| PATCH | `/api/goals/:goalId` | Update goal progress |
| GET | `/api/coach/:coachId/athletes` | Load coach athlete list |

## What This Lets You Show Your Coach

The current prototype proves the interface and concept. The database version proves the system can become a real coaching tool.

With the database added, a coach could:

- Assign workouts
- See whether an athlete completed training
- Monitor habits and consistency
- Track strength, body weight, sprint times, or other testing numbers
- Review goals with actual history instead of static cards

## Suggested Next Build Milestone

The best next milestone is:

> Connect the current front end to Supabase and make workout and habit completion persist across devices.

That milestone is small enough to finish, but important enough to prove this is becoming a real platform.
