# Staging Preview And Release Checklist

Use this runbook for every V2 pull request and staging deployment. It keeps
feature review, database changes, and the eventual production release separate.

## Environment Map

| Environment | Git branch | Web URL | Supabase | Data |
| --- | --- | --- | --- | --- |
| Production | `main` | Existing Rip City beta | RipCity Project (`fdzmfohcuratbuitkwoy`) | Live data |
| Staging | `v2-development` | `https://ripcitystaging.netlify.app` | Rip City Staging (`xjgmjliqqkhfnqphigbk`) | Fake data only |
| Pull-request preview | Feature branch PR into `v2-development` | `https://deploy-preview-<PR>--ripcitystaging.netlify.app` | Rip City Staging | Fake data only |

The staging Netlify project's "production" branch is `v2-development`. That
word refers only to Netlify's primary branch for this separate staging site; it
does not make the site or database the real Rip City production environment.

## Current Netlify Configuration

- Netlify project URL: `https://ripcitystaging.netlify.app`.
- Production branch: `v2-development`.
- Branch deploys: deploy only the production branch.
- Deploy Previews: any pull request against the production branch or an enabled
  branch-deploy branch.
- Production and Deploy Preview visibility: public. App access is still
  protected by Supabase authentication and all data must remain fake.
- No build command; publish the repository root (`.`) as the static site.

Netlify creates a new preview for a pull request after the PR is opened and a
commit is pushed. Existing PRs that predate the Netlify project may need another
push before their first preview appears. Find the preview link in the GitHub PR
checks or Netlify deploy list.

## Current Staging Auth URLs

In **Rip City Staging** only, Supabase Authentication URL Configuration uses:

- Site URL: `https://ripcitystaging.netlify.app`
- Redirect URLs:
  - `https://ripcitystaging.netlify.app/**`
  - `https://**--ripcitystaging.netlify.app/**`
  - `http://localhost:3000/**`

The wildcard Netlify URL permits authentication redirects from pull-request
previews. Localhost remains an optional fallback. Do not copy these values into
the production Supabase project.

## Pull-Request Preview Flow

1. Create the feature branch from the latest `v2-development`.
2. Open a draft PR with base `v2-development` after the first commit.
3. Wait for the Netlify Deploy Preview check to pass.
4. Open the preview URL and confirm it shows the expected branch changes.
5. Use only the fake accounts in `docs/STAGING_TEST_ACCOUNTS.md`.
6. Test the affected coach and member workflows on phone and desktop sizes.
7. Test both Rip City and Test Facility Alpha whenever facility data is read or
   written.
8. Record the tested accounts, devices, migration names, and results in the PR.
9. Resolve review feedback and repeat the affected checks after each fix.
10. Squash-merge only after the other contributor approves the PR.

All previews share the same staging Supabase project. A preview isolates the
frontend code, not database state. Derek and Sam must communicate before either
person applies a migration, and only one schema-changing package may be active
at a time.

## Database-Change Checklist

Before applying SQL:

- Confirm the dashboard project reference is `xjgmjliqqkhfnqphigbk`.
- Confirm the change is a new timestamped file in `supabase/migrations/`.
- Read the migration line by line and identify destructive or data-rewriting
  statements.
- State expected existing-row behavior and rollback/recovery steps in the PR.
- Tell the other contributor that staging schema behavior is changing.

After applying SQL:

- Record the exact migration filename and application date in the PR.
- Run the migration's verification query or test script.
- Test allowed create/read/update/delete behavior for affected roles.
- Test denied cross-facility and wrong-user behavior directly.
- Confirm pending and inactive accounts still cannot access protected data.
- Re-run the baseline/read checks when shared helpers, grants, or RLS policies
  changed.

Never edit the verified initial baseline to represent a later change, and never
run the initial baseline against production.

## Staging Post-Deploy Smoke Test

After a PR merge deploys to the stable staging URL:

- Open the stable URL in a signed-out/private browser and confirm the login page
  loads without a Netlify access screen.
- Log in and log out with an approved fake account.
- Confirm a pending and an inactive fake account remain blocked.
- Confirm Rip City and Test Facility Alpha users cannot see each other's member
  data.
- Test the feature's primary successful workflow and saved state after refresh.
- Test its loading, empty, validation, permission-denied, and error states when
  relevant.
- Check the changed UI at phone and desktop sizes, including keyboard focus,
  labels, touch targets, contrast, and non-color status indicators.
- Check the browser console for new errors.
- Confirm the production beta URL and production Supabase were not changed.

## Recovery And Rollback

### Staging structure recovery

Staging contains fake data and may be rebuilt if necessary:

1. Create a new empty Supabase project with automatic RLS enabled.
2. Follow `docs/STAGING_DATABASE_SETUP.md` to apply the verified baseline.
3. Apply every later migration from `supabase/migrations/` in timestamp order.
4. Run the baseline and feature verification checks.
5. Apply the staging-only seeds in documented order.
6. Recreate the fake Auth identities manually, then connect their profile and
   membership fixture.
7. Recreate Auth URL settings and any required Storage objects/settings not
   represented by SQL.
8. Update only the staging frontend configuration and retest all roles.

### Failed staging migration

- Stop after the first error; save the complete error and do not improvise
  one-time repair SQL.
- If the transaction rolled back, correct the migration in the feature branch
  and rerun it after review.
- If committed data or schema changes remain, write and review an explicit
  forward-fix or rollback migration. Do not edit history after other work
  depends on it.
- Rebuild staging from source when that is safer than repairing fake data.

### Production recovery prerequisite

The production Supabase Free plan does not provide a downloadable scheduled
backup. Before any V2 production migration:

1. Stop schema changes and record the production project reference and migration
   starting point.
2. Create manual logical exports of roles, schema, and data using the current
   official Supabase CLI backup procedure. Store them privately outside this
   repository.
3. Inventory Auth identities and Storage buckets/objects separately. A normal
   database dump or database backup is not by itself a backup of uploaded file
   contents or every project-level setting.
4. Record Auth settings, redirect URLs, secrets/configuration names, and Storage
   bucket configuration without recording secret values in Git.
5. Restore the export into a separate test project and verify important row
   counts and application access before calling the backup usable.
6. Prepare a reviewed forward-fix/rollback for each production migration and
   identify whether it is safe to reverse after new live writes occur.

Never replace production with the staging database, never run staging seeds in
production, and never overwrite live Rip City rows during a V2 release.

## Production Release Gate

Merging `v2-development` into `main` is not the complete V2 release process.
Before that release, the frontend Supabase configuration must select production
for the production deployment and staging for staging/previews. Then both
contributors must verify:

- A tested production backup and recovery procedure exists.
- The production schema is audited against the ordered V2 migrations.
- Only the approved upgrade migrations will be applied; the baseline and fake
  seeds are excluded.
- Production data-preservation behavior is documented for every migration.
- The full regression checklist in `docs/VERSION_2_PLAN.md` passes on staging.
- A post-release production smoke test and rollback decision owner are named.

If any gate is missing, keep V2 on staging.
