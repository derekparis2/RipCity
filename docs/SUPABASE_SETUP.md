# Supabase Setup And Audit Guide

Rip City is already connected to Supabase through `js/supabaseClient.js`. This
guide is for rebuilding, auditing, or safely applying proposed database changes.

## Current Rule

Do not run SQL from this repo blindly against production. Review the file, apply
it manually in Supabase SQL Editor, and test with real member and coach accounts.

The frontend must use the publishable anon key only. Never place the service
role key in browser JavaScript.

## Environment Projects

| Environment | Project | Reference | Branch/data rule |
| --- | --- | --- | --- |
| Production | RipCity Project | `fdzmfohcuratbuitkwoy` | `main`; live Rip City data |
| Staging | Rip City Staging | `xjgmjliqqkhfnqphigbk` | `v2-development`; fake data only |

`js/supabaseClient.js` on `v2-development` intentionally points to staging.
The deployed production app remains on `main` and must continue pointing to the
production project. Before any future V2 production release, verify the target
project as an explicit release-checklist item.

Staging was created on 2026-08-16 with automatic RLS enabled. It started as an
empty project and has not received production data. Do not store a database
password, secret key, or `service_role` key in this repository.

## Fresh Database Setup

For a new Supabase project:

1. Create the Supabase project.
2. In SQL Editor, run `sql/supabase_schema.sql`.
3. Run `sql/seed_rip_city.sql`.
4. Run `sql/profile_fields_v1.sql`.
5. Create the first coach/admin auth user in Supabase Auth.
6. Connect that auth user to `profiles` and `facility_members`.
7. Confirm login, signup, coach approval, member dashboard, and workout logging.

Optional/current migrations:

- `sql/platform_owner_role_v1.sql` when platform-owner tooling is ready.
- `sql/exercise_library_v1.sql` when saved exercise templates should be live.
- `sql/rls_policies_v1.sql` has been applied to the live project and should be
  kept as the current RLS source of truth.

## Existing Live Database Audit

Before applying any migration to the current project, run the read-only audit
queries in `sql/README.md` and compare the output to this repo.

The repository currently contains a browser publishable key but no linked
Supabase CLI project configuration. The publishable key is appropriate for app
testing but cannot provide a complete, authoritative inventory of internal
schema objects and policies. A full audit therefore requires read-only catalog
queries run through the production Supabase SQL Editor or another explicitly
approved authenticated database connection. The audit must not modify
production.

The audit should capture tables/columns, constraints, indexes, functions,
triggers, views, enums, extensions, grants, RLS policies, storage buckets, and
storage policies. Compare those results with both the SQL folder and all app
queries before classifying or removing anything.

The 2026-08-08 live audit verified that production includes the profile fields,
both exercise-library tables,
`workout_exercises.exercise_template_id`, 93 exercise templates, H2K band
support, gender support, username login, and the profile-picture bucket. See
`docs/SUPABASE_AUDIT_2026-08-08.md` before planning any new database work.

## RLS Status

RLS has been enabled on every current public app table in the live Supabase
project. The rollout was verified with:

- Coach/admin login and dashboard access.
- Existing H2K member login, habits, workout dashboard, and session access.
- Existing athlete login with H2K UI hidden.
- New signup, pending approval, coach approval, and approved member login.
- `anon` access intentionally includes `facilities SELECT` and `groups SELECT`
  for the current signup flow.
- `authenticated` grants reduced to normal app CRUD, with row access filtered
  by RLS policies.

The later-created exercise-library tables inherited broader default grants than
this original RLS rollout intended. RLS still blocks anonymous exercise rows,
but grant cleanup is required in staging; see the dated audit.

Signup currently depends on public Rip City signup:

1. `anon` reads the `rip-city` facility.
2. Supabase Auth creates the user.
3. The authenticated session inserts `profiles`, `facility_members`, and
   `member_profiles`.

If Supabase email confirmation is enabled later and no session is returned from
`auth.signUp`, move app-row creation into a secure server-side signup handler or
database trigger.

## RLS Regression Checklist

After any RLS or signup change:

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

## Recovery Scope

Repository-controlled SQL should be sufficient to create a clean application
schema, RLS policies, database functions/triggers, required storage setup, and
required seed configuration in a new Supabase project.

Treat production recovery separately. SQL migrations do not themselves restore
Supabase Auth identities, uploaded Storage objects, secrets, redirect URLs, or
all project-level settings. Maintain and verify backup/recovery instructions for
those resources before V2 production release.

The production project currently uses the Supabase Free plan, and the dashboard
reports that scheduled backups are not included. A paid plan is not required to
continue planning V2, but do not begin risky production migrations without a
tested manual backup/recovery procedure. All destructive testing belongs in the
fake-data staging project.

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
