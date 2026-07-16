# Supabase Setup And Audit Guide

Rip City is already connected to Supabase through `js/supabaseClient.js`. This
guide is for rebuilding, auditing, or safely applying proposed database changes.

## Current Rule

Do not run SQL from this repo blindly against production. Review the file, apply
it manually in Supabase SQL Editor, and test with real member and coach accounts.

The frontend must use the publishable anon key only. Never place the service
role key in browser JavaScript.

## Fresh Database Setup

For a new Supabase project:

1. Create the Supabase project.
2. In SQL Editor, run `sql/supabase_schema.sql`.
3. Run `sql/seed_rip_city.sql`.
4. Run `sql/profile_fields_v1.sql`.
5. Create the first coach/admin auth user in Supabase Auth.
6. Connect that auth user to `profiles` and `facility_members`.
7. Confirm login, signup, coach approval, member dashboard, and workout logging.

Optional migrations:

- `sql/platform_owner_role_v1.sql` when platform-owner tooling is ready.
- `sql/exercise_library_v1.sql` when saved exercise templates should be live.
- `sql/rls_policies_v1.sql` only after review and staging tests.

## Existing Live Database Audit

Before applying any migration to the current project, run the read-only audit
queries in `sql/README.md` and compare the output to this repo.

Known current drift from the repo base schema:

- The live project appears to already include profile UI fields such as
  `profiles.username`, `profiles.bio`, `profiles.birthday`,
  `profiles.profile_picture_url`, `member_profiles.height`,
  `member_profiles.training_focus`, and `member_profiles.favorite_lift`.
- The live project does not appear to have the proposed exercise library tables
  or `workout_exercises.exercise_template_id` yet.

## RLS Rollout Checklist

Before enabling RLS policies:

1. Confirm signup can still insert the required `profiles`,
   `facility_members`, and `member_profiles` rows.
2. Confirm pending members can only see their own pending state.
3. Confirm approved members can see only their facility, profile, assignments,
   workouts, and logs they are authorized for.
4. Confirm athletes do not see H2K-only modules.
5. Confirm coaches/admins can manage only their facility.
6. Confirm platform-owner access is not acting as an accidental cross-facility
   data bypass.
7. Confirm parents have no app data access unless a secure parent policy is
   intentionally introduced.

## Manual App Smoke Test

From the repo root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/login.html`, then test:

- Coach login and approval page.
- Coach workout builder assignment to member, group, and facility.
- H2K member dashboard habits and today workout.
- Athlete dashboard without H2K habits.
- Workout session Save Set and Save All Sets.
- Refresh workout session and confirm saved logs reload.
