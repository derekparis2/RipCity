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

Never run the initial baseline against production. Production reference
`fdzmfohcuratbuitkwoy` is intentionally different.

## What The Baseline Contains

The verified baseline combines the repository-controlled schema, current
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

## Canonical One-Run Migration

The complete verified migration is:

`supabase/migrations/20260816221135_initial_verified_baseline.sql`

It is wrapped in one transaction: if a statement fails, PostgreSQL rolls the
entire baseline back instead of leaving a partially created application schema.

The baseline is for a fresh project. It is not an upgrade migration and should
not be rerun over an existing application schema.

## Run It In Supabase

1. Open **Rip City Staging** in the Supabase dashboard.
2. Confirm the project reference is `xjgmjliqqkhfnqphigbk`.
3. Open **SQL Editor** and create a new query.
4. Open `supabase/migrations/20260816221135_initial_verified_baseline.sql`
   locally and copy all of it.
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

Every row in its single result table must say `PASS`.

Do not proceed to fake users or V2 migrations if any verification check fails.

## Project Settings After SQL Verification

Match the staging Auth behavior needed by the current application without
copying production secrets or real accounts:

- Email/password sign-in enabled.
- Email confirmation disabled for the current signup/approval workflow.
- Anonymous sign-in disabled.
- Site URL set to `http://localhost:3000` until a staging site exists, never the
  production beta URL.
- Exact local password-reset redirects added:
  - `http://localhost:3000/set-password.html`
  - `http://127.0.0.1:3000/set-password.html`

Storage objects and Auth users must be created separately; SQL schema files do
not restore them.

## Next Milestone

After schema verification, create entirely fake Auth users and application rows
for two facilities, all active roles, pending/inactive statuses, and a coach
with memberships in both facilities. Then run the cross-facility RLS matrix
before starting V2 feature migrations.
