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
- Coach dashboard for H2K habit score overview
- Member dashboard with H2K habit tracking
- Today’s workout card on the member dashboard
- Coach workout builder with blocks and exercises
- Group/date workout assignment
- Workout session page with round/superset display
- Set-by-set actual result logging
- Save Set and Save All Sets
- Member profile editing

## Important Files

- `docs/BUILD_PLAN.md` - product direction and phases
- `sql/supabase_schema.sql` - current intended database schema
- `js/supabaseClient.js` - Supabase browser client setup
- `js/auth.js` - signup, login, and pending-page auth actions
- `js/coach-approvals.js` - coach/admin approval workflow
- `js/coach-dashboard.js` - coach H2K score overview
- `js/coach-workouts.js` - coach workout builder and assignment flow
- `js/member-dashboard.js` - member dashboard, habits, and today’s workout
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

- The member dashboard is still H2K-heavy and should become a true shared dashboard for athletes and other program types.
- Coach workout assignment currently focuses on group/date assignment; individual and facility assignment UI should be added.
- There is not yet a workout completion dashboard for coaches.
- Goals, progress charts, leaderboards, coach notes, and community features are mostly future-facing.
- Profile image upload is not implemented; profile picture is URL-only for now.
