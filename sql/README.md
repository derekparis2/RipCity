# Rip City SQL Files

These files are source-controlled database references and migration proposals.
Run SQL manually in Supabase SQL Editor only after reviewing it. Codex should
not execute live database SQL unless Derek explicitly asks.

## Current Base Files

- `supabase_schema.sql` - current base schema reference for a clean Rip City
  database. This should stay aligned with live schema over time.
- `seed_rip_city.sql` - starter Rip City facility, groups, and default H2K
  habit data.

## Current Migration Proposals

- `profile_fields_v1.sql` - non-destructive profile columns used by the profile
  page. The current live database appears to already have these fields, but a
  clean rebuild needs this migration unless the base schema is updated.
- `platform_owner_role_v1.sql` - proposed platform-owner role support. This is
  needed before Derek-only platform administration/support tooling can be made
  explicit and safe.
- `exercise_library_v1.sql` - proposed exercise library and substitution base.
  The app currently falls back gracefully if this migration has not been run.
- `rls_policies_v1.sql` - proposed Row Level Security policies. Review and test
  carefully before enabling in production.

## Historical Files

- `starter_schema_v1.sql` - early prototype schema. Keep for history only. Do
  not run it against the current Rip City Supabase project.

## Safe Migration Order For A Fresh Database

1. Run `supabase_schema.sql`.
2. Run `seed_rip_city.sql`.
3. Run `profile_fields_v1.sql`.
4. Optional: run `platform_owner_role_v1.sql` when platform-owner support is
   ready.
5. Optional: run `exercise_library_v1.sql` when the exercise library should be
   live.
6. Review, stage-test, then run `rls_policies_v1.sql`.

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
