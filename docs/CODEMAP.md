# Rip City Code Map

Use this as the quick orientation guide before editing.

## App Entry Points

- `index.html` redirects to `login.html`.
- `login.html`, `signup.html`, and `pending.html` handle account entry.
- `member-dashboard.html` is the shared member home for athletes and H2K members.
- `workout-session.html` is the member workout logging screen.
- `coach-dashboard.html`, `coach-roster.html`, `coach-workouts.html`, and `coach-approvals.html` are the coach/admin surfaces.

## Shared JavaScript

- `js/supabaseClient.js` creates the Supabase browser client.
- `js/access-control.js` centralizes auth, approval, role, and facility membership checks.
- `js/ui-utils.js` contains display safety helpers, shared formatting helpers, and the beta feedback link config.
- `js/workout-data.js` contains shared workout assignment visibility, date handling, block sorting, and set-log summary helpers.

## Feature JavaScript

- `js/auth.js` controls signup, username/email login, pending logout, and post-login routing.
- `js/coach-approvals.js` lets coaches/admins approve or reject pending members.
- `js/coach-roster.js` manages facility members, group membership, member status, and H2K band color.
- `js/coach-dashboard.js` powers H2K score review and coach workout completion review.
- `js/coach-workouts.js` powers workout creation, assignment, recent workout reuse, and the exercise library.
- `js/member-dashboard.js` powers member stats, H2K habits, today’s workout, workout history, and feedback link display.
- `js/profile.js` powers member profile editing and the read-only H2K band display.
- `js/workout-session-core.js`, `js/workout-session-render.js`, and `js/workout-session.js` split workout logging into state/loaders, rendering, and save actions.

## Archived Reference

- `old/prototype/index.html` and `old/prototype/app.js` are the old localStorage prototype. Keep them for design/history reference only.
- `docs/old/` contains old planning notes.
- `sql/old/` contains old prototype SQL that should not be run against the live Supabase project.
