# Rip City Athlete Development Platform

Rip City is a Supabase-backed member platform for athletes, H2K members, coaches, and future facility programs.

The current direction is a shared platform first:
- shared dashboard, profile, workouts, goals, progress, leaderboards, coach notes
- H2K-specific habit scoring
- athlete-specific performance modules later
- future schedule, attendance, payments, and parent access

For the product roadmap, start with `docs/BUILD_PLAN.md`.

## Current Working Areas

- Supabase auth and app database connection
- Signup, login, pending approval, and logout flows
- Coach/admin approval page
- Coach dashboard for H2K habit score overview and workout completion review
- Shared member dashboard with optional H2K habit tracking
- Today’s workout and workout history on the member dashboard
- Coach workout builder with blocks and exercises
- Member, group, and facility workout assignment
- Proposed exercise library support with graceful fallback before migration
- Workout session page with round/superset display
- Set-by-set actual result logging
- Save Set and Save All Sets
- Member profile editing

## Important Files

- `docs/BUILD_PLAN.md` - product direction and phases
- `docs/PRODUCT_DECISIONS.md` - current product rules and tenant decisions
- `sql/supabase_schema.sql` - current intended database schema
- `sql/README.md` - SQL file guide, migration order, and audit queries
- `js/supabaseClient.js` - Supabase browser client setup
- `js/access-control.js` - shared auth and facility membership guard helpers
- `js/workout-data.js` - shared workout assignment, date, and completion helpers
- `js/ui-utils.js` - shared escaping and display helpers
- `js/auth.js` - signup, login, and pending-page auth actions
- `js/coach-approvals.js` - coach/admin approval workflow
- `js/coach-dashboard.js` - coach H2K score and workout completion overview
- `js/coach-workouts.js` - coach workout builder and assignment flow
- `js/member-dashboard.js` - member dashboard, habits, today’s workout, and history
- `js/workout-session-core.js` - workout session state, helpers, auth, and loaders
- `js/workout-session-render.js` - workout session block/round/set rendering
- `js/workout-session.js` - workout session save actions and page init
- `css/styles.css` - shared visual system and page styles

## Running Locally

This is a static frontend. From the repo root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/login.html
```

Use approved Supabase test accounts for end-to-end checks.

## Testing Checklist

- Sign up a member and approve them as a coach/admin.
- Log in as an H2K member.
- Confirm habits load and save.
- Confirm today’s workout appears when assigned to the member, their group, or the facility.
- Open the workout session.
- Save one set.
- Save all sets.
- Refresh and confirm saved set logs reload.
- Check mobile width for member dashboard and workout session.

## Current Known Gaps

- Row Level Security policies are proposed in `sql/rls_policies_v1.sql` but should be reviewed and tested before applying.
- The exercise library UI exists, but the live database needs `sql/exercise_library_v1.sql` before saved templates are available.
- Goals, progress charts, leaderboards, coach notes, and community features are mostly future-facing.
- Profile image upload is not implemented; profile picture is URL-only for now.
- Platform owner/support mode needs explicit UX and policies before cross-facility operations are added.
