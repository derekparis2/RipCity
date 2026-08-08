# Rip City SQL Files

These files are source-controlled database references, applied historical
changes, and migration proposals. Run SQL manually only after reviewing its
classification below. Codex should not execute live database SQL unless Derek
explicitly asks.

The live production comparison is recorded in
`docs/SUPABASE_AUDIT_2026-08-08.md`. That audit is the current evidence for the
classifications below.

## Current Base Files

- `supabase_schema.sql` - current base schema reference for a clean Rip City
  database. It is not currently a complete or verified production rebuild.
- `seed_rip_city.sql` - starter Rip City facility, groups, and default H2K
  habit data.

## Verified Applied / Active SQL

- `rls_policies_v1.sql` - the main RLS set is live. The file header is outdated.
- `signup_group_selection_v1.sql` - live signup group-selection policy patch.
- `profile_picture_storage_v1.sql` - live profile-picture bucket and policies.
- `username_login_v1.sql` - live username index and login resolver function.
- `exercise_library_v1.sql` - live exercise-template/substitution schema and
  policies. Do not rerun until grant and policy-name drift is corrected.
- `exercise_library_seed_rip_city_v1.sql` - live 93-exercise Rip City seed.
- `h2k_band_color_v1.sql` - live H2K band column, trigger, and function.
- `h2k_band_color_v2_levels.sql` - applied historical H2K constraint follow-up.
- `profile_gender_v1.sql` - applied historical gender-field migration.
- `profile_gender_v2_remove_nonbinary.sql` - applied historical/data migration.

`profile_fields_v1.sql` is partially represented: its columns are live, but its
named username index is not. Production instead uses the similar index from
`username_login_v1.sql`. Do not run both unchanged in a clean rebuild because
they would create redundant case-insensitive username indexes.

## Not Applied To Production

- `platform_owner_role_v1.sql` - proposed platform-owner role support. Production
  currently allows only member/coach/admin global-role values. Test the complete
  role and RLS design in staging before applying it.

## Historical Files

- `old/starter_schema_v1.sql` - early prototype schema. Keep for history only.
  Do not run it against the current Rip City Supabase project.

After a verified staging baseline exists, several applied one-time migrations
may move into an applied/archive folder. Do not move or delete them before the
baseline has reproduced the audited production structure.

## Known Live Drift / Do Not Rerun Yet

- `exercise_templates` and `exercise_substitutions` inherited overly broad
  `anon` and `authenticated` table privileges. RLS blocks anonymous rows, but
  explicit grant cleanup is still required.
- Three live `exercise_substitutions` policy names use singular `substitution`;
  the repository uses plural `substitutions`. Rerunning the file may create
  duplicate policies.
- The H2K trigger function inherited default public execute privilege, although
  `anon` has no usage on the `app_private` schema.
- Production has no recorded Supabase migration history.
- The current Free plan provides no scheduled dashboard backups.

## Old Fresh-Database Order — Not Yet Verified

The following order documents the original intent, but it is not currently a
safe or complete one-command production rebuild. Use it only as input to the
staging baseline work, not as instructions to run blindly.

1. Run `supabase_schema.sql`.
2. Run `seed_rip_city.sql`.
3. Run `profile_fields_v1.sql`.
4. Run `profile_picture_storage_v1.sql` before enabling profile picture uploads.
5. Optional: run `platform_owner_role_v1.sql` when platform-owner support is
   ready.
6. Optional: run `exercise_library_v1.sql` when the exercise library should be
   live.
7. Optional: run `exercise_library_seed_rip_city_v1.sql` after the exercise
   library base migration.
8. Optional: run `h2k_band_color_v1.sql`, then `h2k_band_color_v2_levels.sql`
   if H2K bands should be live.
9. Review, stage-test, then run `rls_policies_v1.sql`.
10. Run `signup_group_selection_v1.sql` if athlete signup should require a
    starting training group.

This list currently omits or mishandles applied username, gender, H2K, exercise,
grant, and policy-name details. Replace it with one verified ordered migration
set after the staging rebuild succeeds.

## Live Database Audit Queries

Use these read-only queries in the Supabase SQL Editor when checking drift.

```sql
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
