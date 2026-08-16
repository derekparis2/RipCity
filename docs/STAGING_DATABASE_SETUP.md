# Rip City Staging Database Setup

## Purpose

This runbook creates the current audited Rip City application structure in a
new, empty Supabase staging project. It does not copy production member data,
Auth users, uploaded files, secrets, or project settings.

Target project:

- Name: **Rip City Staging**
- Reference: `xjgmjliqqkhfnqphigbk`
- URL: `https://xjgmjliqqkhfnqphigbk.supabase.co`
- Data rule: fake data only

Status: the baseline and every verification check passed in Rip City Staging on
2026-08-16. The project contains required configuration but no Auth users or
member/workout activity data.

Never run the generated baseline against production. Production reference
`fdzmfohcuratbuitkwoy` is intentionally different.

## What The Baseline Contains

The generated baseline combines the repository-controlled schema, current
profile fields, final gender constraint, RLS helpers and policies, signup group
support, username login, final H2K band constraint and protection trigger,
exercise library, profile-picture Storage setup, and required Rip City seeds.

It also fixes the known rebuild problems identified in the 2026-08-08 audit:

- Only one case-insensitive username index is created.
- Exercise-library tables receive explicit, narrow API privileges.
- Exercise-substitution policies use short canonical names that stay below
  PostgreSQL's 63-byte identifier limit.
- The H2K protection trigger function is not directly executable by API roles.
- Default privileges leave future public tables closed until reviewed grants
  and RLS policies are added.

## Build The One-Run SQL File

From the repository root:

```bash
bash scripts/build-staging-baseline.sh
```

This creates `sql/generated/staging_baseline.sql`. The generated file is wrapped
in one transaction: if a statement fails, PostgreSQL rolls the entire baseline
back instead of leaving a partially created application schema.

The baseline is for a fresh project. It is not an upgrade migration and should
not be rerun over an existing application schema.

## Run It In Supabase

1. Open **Rip City Staging** in the Supabase dashboard.
2. Confirm the project reference is `xjgmjliqqkhfnqphigbk`.
3. Open **SQL Editor** and create a new query.
4. Open `sql/generated/staging_baseline.sql` locally and copy all of it.
5. Paste it into the staging query.
6. Reconfirm the browser URL contains `xjgmjliqqkhfnqphigbk`.
7. Click **Run** once.
8. Stop and save the complete error if Supabase reports any failure. Do not run
   individual repair statements until the source migration is corrected.

The baseline creates no Auth users. Its only rows are required Rip City setup
data: one facility, five groups, six habits, and 87 repository-controlled
starter exercise templates.

Production currently contains 93 exercise templates. Git history confirms the
starter seed has always contained 87, so six production templates were added
outside the repository seed. They are production data, not silently invented
baseline rows, and must be exported/classified during the production-backup
work before a disaster-recovery procedure is considered complete.

The 2026-08-16 comparison confirmed all six have a creator and all 87 seeded
names remain present. Production also changes `Push-Up` and `Tempo Push-Up`
from the seeded `completion` input type to `weight_reps`. See the dated audit
for the exact six names. These mutable facility changes should be restored from
a production-data backup rather than folded into the clean starter baseline by
default.

## Verify The Result

After the baseline succeeds, run the read-only file:

`sql/diagnostics/verify_staging_baseline.sql`

Every row in the first result should say `PASS`. The anon-grant result should
list only `facilities: SELECT` and `groups: SELECT`. The final policy-drift query
should return zero rows.

Do not proceed to fake users or V2 migrations if any verification check fails.

## Project Settings After SQL Verification

Match the staging Auth behavior needed by the current application without
copying production secrets or real accounts:

- Email/password sign-in enabled.
- Email confirmation disabled for the current signup/approval workflow.
- Anonymous sign-in disabled.
- Site URL set to the local or staging site, never the production beta URL.
- Local redirect URL added for the selected development port.

Storage objects and Auth users must be created separately; SQL schema files do
not restore them.

## Next Milestone

After schema verification, create entirely fake Auth users and application rows
for two facilities, all active roles, pending/inactive statuses, and a coach
with memberships in both facilities. Then run the cross-facility RLS matrix
before starting V2 feature migrations.
