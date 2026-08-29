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
- Coach roster and group management
- Coach dashboard for H2K habit score overview and workout completion review
- Shared member dashboard with optional H2K habit tracking
- Today’s workout and workout history on the member dashboard
- Coach workout builder with blocks and exercises
- Member, group, and facility workout assignment
- Exercise library support for saved, editable coach exercise templates
- H2K band color support, managed by coaches from the roster
- Workout session page with round/superset display
- Set-by-set actual result logging
- Save Set and Save All Sets
- Member profile editing

## Important Files

- `CONTRIBUTING.md` - shared Derek/Sam branch, review, testing, and database workflow
- `docs/BUILD_PLAN.md` - product direction and phases
- `docs/BETA_TEST_CHECKLIST.md` - walkthrough checklist for early testers
- `docs/archive/v1/BETA_LAUNCH_PLAN.md` - historical V1 beta launch checklist
- `docs/DEPLOYMENT_PREP.md` - live URL, Supabase Auth, storage, and final deploy checks
- `docs/PRODUCT_DECISIONS.md` - current product rules and tenant decisions
- `docs/PERMISSIONS_MATRIX.md` - V2 role, status, module, and RLS access contract
- `docs/SUPABASE_AUDIT_2026-08-08.md` - read-only production schema/SQL audit,
  verified drift, recovery risks, and staging recommendations
- `docs/STAGING_DATABASE_SETUP.md` - exact empty-project baseline build, run,
  and verification instructions for Rip City Staging
- `docs/STAGING_TEST_ACCOUNTS.md` - fake staging identities and role scenarios
- `supabase/migrations/` - active, ordered database migrations
- `sql/README.md` - SQL diagnostics/archive guide and safety rules
- `js/shared/` - Supabase client, access control, UI, and workout-data helpers
- `js/auth/` - signup, login, pending, and password actions
- `js/coach/` - coach approval, dashboard, roster, and workout-builder behavior
- `js/member/` - member dashboard, profile, and workout-session behavior
- `css/styles.css` - shared visual system and page styles

## Running Locally

This is a static frontend. From the repo root:

```bash
python3 -m http.server 3000
```

Then open:

```text
http://localhost:3000/login.html
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
- Upload a profile picture and confirm it appears on the profile and member dashboard.
- Check mobile width for member dashboard and workout session.

## Current Known Gaps

- Calculated maxes, volume tracking, and PR tracking still need product/math decisions before showing official numbers.
- Goals, progress charts, leaderboards, coach notes, and community features are mostly future-facing.
- Platform owner/support mode needs explicit UX and policies before cross-facility operations are added.
