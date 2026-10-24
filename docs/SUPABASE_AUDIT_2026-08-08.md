# Supabase Production Audit - 2026-08-08

## Purpose

This document records a read-only comparison of the live Rip City production
Supabase project, the repository SQL, and the active application queries.

No production data, schema, policies, grants, Auth settings, or Storage settings
were changed during this audit. The audit used the Supabase dashboard and
catalog-only `SELECT` queries.

## Executive Summary

The live V1 database is healthy and internally consistent. All 21 public tables
are represented in repository SQL, all Auth users have matching app profiles,
and no broken member-profile relationships were found.

The main risk is reproducibility and recovery, not a currently broken app:

- Supabase shows no recorded migration history.
- The Free plan currently provides no scheduled dashboard backups or point-in-time recovery.
- At audit time, the repository's base schema was not sufficient by itself to
  recreate production. This was resolved by the verified initial staging
  migration on 2026-08-16.
- Several SQL files labeled as proposals have already been applied.
- Two exercise-library tables inherited broader database grants than intended.
- Three live exercise-substitution policy names appeared to differ from their
  repository names; staging later confirmed PostgreSQL's 63-byte identifier
  truncation was the cause.
- Some live RLS policies must change before V2 goals and private coach notes are used.

Do not make cleanup changes directly in production. Correct and verify them in a
new staging project first.

## What "No Backups" Means

The production project currently runs on the Supabase Free plan. The dashboard
states that this plan does not include project backups.

This does not mean the database is about to disappear. It means Rip City does
not currently have a user-accessible restore point if data is lost through an
accidental SQL command, a cascading delete, a faulty migration, compromised
admin access, project deletion, or another unexpected incident.

Paying for a Supabase plan is not required today. Before risky V2 database work:

1. Create the staging project and perform all experiments there.
2. Create and test a manual production backup procedure.
3. Keep schema migrations and required seed data in the repository.
4. Revisit managed backups with Rip City when usage, budget, and production risk justify it.

Schema reconstruction and production-data recovery are separate:

- Repository SQL should recreate tables, policies, functions, triggers, indexes,
  required Storage setup, and required seed configuration.
- A production backup must preserve real rows and account for Auth identities
  and Storage objects separately.

## Verified Live Inventory

### Database Objects

- 21 public tables
- 194 public columns
- 97 table constraints
  - 20 check constraints
  - 44 foreign keys
  - 12 unique constraints
  - remaining constraints are primary keys
- 55 public indexes
- 93 public-table RLS policies
- 18 `app_private` security/helper functions
- 1 public username-resolution function
- 1 enabled H2K band-protection trigger
- No public views
- No public materialized views
- No public sequences
- No custom public enum types

RLS is enabled on all 21 public tables.

### Enabled Extensions

- `pg_stat_statements`
- `pgcrypto`
- `plpgsql`
- `supabase_vault`
- `uuid-ossp`

Some of these are normal Supabase-managed project extensions and do not all need
to be recreated manually by application migrations.

### Current Aggregate Data Health

- 21 Auth users
- 21 application profiles
- 21 facility memberships
- 20 member profiles
- 17 approved memberships
- 4 pending memberships
- 1 facility admin
- 1 coach
- 1 athlete
- 18 H2K members
- 0 Auth users without app profiles
- 0 app profiles without Auth users
- 0 member profiles without memberships
- 0 athlete/H2K memberships missing member profiles

One facility admin also has an athlete member profile. This appears to be the
existing Derek/admin setup, not an orphaned record.

### Current Feature Data

- 1 facility
- 5 groups
- 6 habits
- 41 habit-log rows
- 4 workouts
- 4 workout assignments
- 6 exercise set-log rows
- 93 exercise templates total: 87 from the repository starter seed and six
  additional production records not represented by that seed
- 0 exercise substitutions
- 0 goals
- 0 progress entries
- 0 coach notes
- 0 parent links
- 0 AI summaries
- 0 facility invite-code rows

### Exercise Template Source Comparison - 2026-08-16

A read-only production export was compared by name and editable seed field with
`sql/archive/applied/exercise_library_seed_rip_city_v1.sql`:

- All 87 repository starter exercises are present in production.
- Six additional templates have `created_by` populated, confirming that they
  were created through a coach/admin workflow rather than by the starter seed:
  - `10-20-30 Shuttle Intervals`
  - `Abductor Activation`
  - `DB Suitcase Carry`
  - `GOATA Ankle Series`
  - `Half Hollow Hold`
  - `Push Up to Sprint`
- Two starter templates were edited in production after seeding:
  - `Push-Up`: `input_type` changed from `completion` to `weight_reps`.
  - `Tempo Push-Up`: `input_type` changed from `completion` to `weight_reps`.
- No repository starter exercise is missing from production.

The six coach-created rows and the two coach-edited values are mutable facility
data, not missing baseline schema. Preserve them through production-data backup
and recovery. Do not silently turn mutable coach content into universal starter
defaults without a separate product decision.

## Authentication And Storage

Verified Auth configuration:

- New user signup is enabled.
- Email/password authentication is enabled.
- Email confirmation is disabled.
- Anonymous authentication is disabled.
- Other listed social providers are disabled.
- Production Site URL is `https://rip-city-training.netlify.app`.
- The project has 17 production redirect URLs.
- Localhost and staging redirect URLs have not yet been added.

Verified Storage configuration:

- One public bucket: `profile-pictures`
- 5 MB file limit
- JPEG, PNG, WebP, and GIF allowed
- Four expected profile-picture policies
- Zero stored objects at audit time

## Repository SQL Classification

### Applied / Active References

- `sql/archive/applied/supabase_schema.sql`
  - The original base for all 19 original public tables.
  - It is incomplete as a production rebuild because later columns, tables,
    functions, policies, Storage, and indexes live in separate files.
- `sql/archive/applied/seed_rip_city.sql`
  - Rip City, five groups, and six habits match production.
- `sql/archive/applied/rls_policies_v1.sql`
  - The main policy set is live despite the file header calling it proposed.
- `sql/archive/applied/signup_group_selection_v1.sql`
  - Its public/pending group policies are live.
- `sql/archive/applied/profile_picture_storage_v1.sql`
  - The bucket and four policies are live.
- `sql/archive/applied/username_login_v1.sql`
  - The function and `profiles_username_lower_unique` index are live.
- `sql/archive/applied/exercise_library_v1.sql`
  - Both tables, their columns, indexes, and policies are live.
  - The live policy names and database grants need cleanup in staging.
- `sql/archive/applied/exercise_library_seed_rip_city_v1.sql`
  - All 87 repository starter exercises are live.
  - Production contains six additional exercise templates that need separate
    export/classification as production data.
- `sql/archive/applied/h2k_band_color_v1.sql`
  - The column, function, trigger, and constraint are live.
- `sql/archive/applied/h2k_band_color_v2_levels.sql`
  - The final band constraint is live; this follow-up is mostly historical/redundant.
- `sql/archive/applied/profile_gender_v1.sql`
  - Applied historical migration.
- `sql/archive/applied/profile_gender_v2_remove_nonbinary.sql`
  - Applied historical/data-cleanup follow-up; the final constraint allows
    `female`, `male`, `other`, or null.

### Partially Represented Live State

- `sql/archive/applied/profile_fields_v1.sql`
  - Its profile/member columns are live.
  - Its `profiles_username_unique_idx` index is not live.
  - Production instead has the similar `profiles_username_lower_unique` index
    from `username_login_v1.sql`.
  - Running both files in the documented fresh order would create redundant indexes.

### Not Applied

- `sql/archive/proposals/platform_owner_role_v1.sql`
  - Production still restricts `profiles.global_role` to `member`, `coach`, or `admin`.
  - No production profile currently has `platform_owner`.
  - Apply only after V2 role/RLS design is tested in staging.

### Historical Only

- `sql/archive/experiments/starter_schema_v1.sql`
  - Old prototype schema. Never run against production or a new V2 database.

## Security And Migration Drift

### Exercise-Library Table Grants

The live `anon` role has `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`REFERENCES`, and `TRIGGER` table privileges on:

- `exercise_templates`
- `exercise_substitutions`

These tables appear to have inherited Supabase default grants because they were
created after the main RLS file revoked broad privileges on the original tables.

RLS has no anonymous policies for these tables and blocked anonymous rows during
the audit. No exercise data exposure was found. The grants are still broader
than intended and should be corrected with a staging-tested migration that:

- Revokes broad `anon` access.
- Gives `authenticated` only the table privileges required by the app.
- Preserves the existing facility-scoped RLS policies.
- Explicitly sets privileges/default privileges for future tables.

### Exercise-Substitution Policy Names

The live insert, update, and delete policy names end with singular
`facility substitution`. The repository migration attempts to drop/create names
ending with plural `facility substitutions`.

The policy expressions themselves match the intended facility-scoped behavior.
Staging reconstruction on 2026-08-16 established that PostgreSQL's 63-byte
identifier limit silently truncates the longer plural names. This was not
independent policy-expression drift. The baseline now uses shorter canonical
names so stored policy identifiers remain explicit and predictable.

`exercise_substitutions` is a future, currently empty table that maps one
facility exercise template to an approved alternative template. V1 does not use
it in the frontend.

### H2K Trigger Function Grant

The H2K trigger function inherited default public execute privilege because it
was created after the main function-grant cleanup. Anonymous users do not have
usage on the `app_private` schema, so it is not directly callable through the
normal API. A consolidated baseline should still explicitly revoke unnecessary
function access instead of relying on the schema boundary alone.

## V2 Product/RLS Gaps

### Coach Notes

Current live policies allow targeted members to read `coach_notes` and allow any
facility coach to update/delete facility notes. This conflicts with V2 rules:

- Notes are private to facility coaches/admins.
- Coaches edit/delete only notes they created.
- Facility admins may manage all facility notes.

The table currently has zero rows. Replace these policies before storing notes.

### Goals

The live table currently allows members to read their goals but only coaches to
write them. V2 requires member-created goals, member editing/deletion of their
own goals, and limited status-only updates to coach-created goals. A dedicated
goals migration and RLS test matrix are required.

### Platform Owner

The platform-owner migration is not live and the existing RLS does not implement
global-owner workflows. Add this only with the roles/permissions matrix and
two-facility staging tests.

### Lifecycle And Cascades

Production foreign keys match the repository and use extensive cascade deletion.
Deleting a workout removes blocks, exercises, assignments, and saved set logs.
Deleting facilities, groups, memberships, profiles, or habits can also remove
related history.

V2 should add archive/deactivate behavior before exposing broader destructive
administrative controls.

## Recommended Next Steps

1. Commit the current documentation changes.
2. Keep production unchanged while creating `rip-city-staging`.
3. Reorganize SQL into migrations, seeds, diagnostics, and archive.
4. Build one verified staging baseline that recreates this audited live structure.
5. Remove redundant username-index creation from the fresh setup.
6. Correct exercise grants and normalize the truncated policy names in staging.
7. Seed two fake facilities and all required fake roles/statuses.
8. Run cross-facility and RLS regression tests.
9. Write and test a manual production-data backup procedure.
10. Include the six non-seed production exercise templates in that export and
    determine whether they should become maintained seed/configuration data.
11. Revisit paid managed backups with Rip City when budget and risk justify it.

Do not run cleanup migrations on production until staging passes the full
regression and release checklist.
