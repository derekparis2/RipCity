# Rip City Code Map

Use this as the quick orientation guide before editing.

## App Entry Points

- `index.html` redirects to `login.html`.
- `login.html`, `signup.html`, and `pending.html` handle account entry.
- `member-dashboard.html` is the concise shared member home for athletes and H2K members.
- `member-training.html`, `member-habits.html`, `member-leaderboards.html`, and
  `member-goals.html` are the dedicated member feature pages. Weekly habit
  history is part of Habits; the older `member-history.html` route remains only
  as a compatibility page. `profile.html` remains the dedicated profile page.
- `js/member/member-nav.js` owns the shared member destination map so member
  tabs do not drift or disappear between pages.
- `js/coach/coach-nav.js` owns the shared coach/admin destination map and the
  compact mobile menu so Dashboard, Roster, Workout Builder, Leaderboards, and
  Approvals remain available from every coach surface.
- `workout-session.html` is the member workout logging screen.
- `coach-dashboard.html`, `coach-roster.html`, `coach-workouts.html`,
  `coach-exercises.html`, `coach-testing.html`, `coach-leaderboards.html`, and `coach-approvals.html`
  are the coach/admin surfaces.
  The Exercise Library is intentionally linked only from the Workout Builder.

## Shared JavaScript

- `js/shared/supabaseClient.js` creates the Supabase browser client.
- `js/shared/access-control.js` centralizes auth, approval, role, and facility membership checks.
- `js/shared/ui-utils.js` contains display safety helpers, shared formatting
  helpers, and the temporary member/coach dashboard feedback-link config.
- `js/shared/workout-data.js` contains shared workout assignment visibility, date handling, block sorting, and set-log summary helpers.
- `js/shared/leaderboard-metrics.js` contains shared habit-score and legacy
  workout-attendance calculations plus rolling-average, streak, and
  competition-ranking rules used by coach and member views.
- `js/shared/attention-rules.js` contains the coach-approved consecutive missed
  habit and assigned-workout follow-up rules.

## Feature JavaScript

- `js/auth/auth.js` controls reusable member signup, single-use coach-invite
  signup, username/email login, status-specific blocked-account messaging,
  pending logout, and post-login routing.
- `js/coach/coach-approvals.js` lets coaches/admins approve or reject ordinary
  pending members. Facility admins can also create coach links and decide
  pending coach requests, then deactivate or reactivate existing coach
  memberships without deleting history.
- `js/coach/coach-roster.js` manages facility members, group membership, member
  status, H2K band color, roster pagination, and the two program-specific member
  signup links.
- `js/coach/coach-dashboard.js` powers the coach needs-attention queue and
  workout completion review.
- `js/coach/coach-announcements.js` powers the dashboard announcement composer,
  audience selection, published list, and authorized deletion.
- `js/coach/member-history.js` powers the shared 12-week habit history shown on
  an individual coach member-detail page.
- `js/coach/coach-leaderboards.js` powers the facility-scoped H2K and athlete
  leaderboard page, including group filters, member search, and the selectable
  metric registry used to rank by rolling results or streaks. Future lift and
  testing leaderboards should extend that registry rather than add a separate
  ranking implementation.
- `js/coach/coach-testing.js` powers Testing Day creation, multi-group and
  individual roster selection, ordered test batteries, scheduling, and
  cancellation. Result entry is intentionally absent pending the approved role.
- `js/coach/workouts/` powers workout creation, assignment, recent workout reuse,
  and the exercise library. `page.js` is the page controller, with the form UI
  in `builder.js`, assignment behavior in `assignments.js`, saved-workout
  behavior in `history.js`, exercise-library behavior in `exercise-library.js`,
  the standalone library controller in `exercise-library-page.js`, and common
  state/helpers in `core.js` and `data.js`.
- The standalone Exercise Library progressively renders 24 matching exercises
  at a time; changing a search or filter resets that visible result window.
- `js/member/member-dashboard.js` powers shared athlete/H2K habit stats,
  today’s workout, workout history, and feedback link display.
- `js/member/member-announcements.js` renders the active facility, group, and
  individual announcements permitted to the signed-in member by RLS.
- `js/member/member-testing-days.js` renders assigned scheduled Testing Days and
  their ordered test batteries on the member Training page without loading or
  writing results.
- `js/member/member-leaderboards.js` renders the program-separated member Top
  5 and own-rank view. It reads only the privacy-safe leaderboard RPC rather
  than loading facility rosters or other members' raw habit logs.
- `js/member/profile.js` powers member profile editing and the read-only H2K band display.
- `js/member/workout-session-core.js`, `js/member/workout-session-render.js`, and
  `js/member/workout-session.js` split workout logging into state/loaders,
  rendering, and save actions.

## Archived Reference

- `docs/archive/` contains completed version-specific plans that are retained
  only when they still provide useful release history.
- `sql/archive/` contains applied components, proposals, one-time fixes, and
  prototype SQL that should not be run against staging or production.
