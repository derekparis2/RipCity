# Contributing To Rip City

This guide is the shared development agreement for Derek, Sam, and future
contributors. Derek and Sam can both work across the application and database.
Communication, review, staging verification, and small pull requests are the
safety boundaries.

## Branches And Environments

- `main` is the deployed production branch used by Rip City.
- `v2-development` is the shared integration branch for Version 2.
- Create a feature branch from the latest `v2-development` for every unit of
  work, such as `derek/contributor-foundation` or `sam/goals-v2`.
- Do not commit V2 work directly to `main` or `v2-development`.
- Production hotfixes are the only normal reason to branch from `main`. Merge
  an approved production hotfix back into `v2-development` afterward.

Production uses the live Supabase project. Version 2 uses **Rip City Staging**
and entirely fake data until a production release is explicitly approved.

## Starting A Feature

```bash
git switch v2-development
git pull origin v2-development
git switch -c your-name/short-feature-name
git push -u origin your-name/short-feature-name
```

After the first commit is pushed, open a draft pull request with:

- Base: `v2-development`
- Compare: the feature branch
- A short description of the product behavior and affected pages/data

GitHub cannot open a pull request while the feature branch is identical to its
base. Make and push the first commit, then create the draft pull request.

## Working Together

- Derek and Sam may both change frontend code, migrations, RLS, and staging.
- Tell the other person before editing shared database behavior or applying a
  migration to staging.
- Keep only one active staging schema migration in flight at a time.
- Coordinate before both editing the same large file or feature area.
- Make small, descriptive commits and keep unrelated cleanup out of feature
  pull requests.
- Push work regularly so it is visible and recoverable.
- Do not force-push shared branches unless both contributors agree.

Before requesting final review, update the feature branch with the current
integration branch:

```bash
git fetch origin
git merge origin/v2-development
git push
```

Resolve merge conflicts on the feature branch, then retest the affected flows.
Use a normal merge for this shared workflow rather than rewriting published
history with a rebase.

## Pull Request And Merge Flow

1. Open the pull request as a draft early.
2. Keep its description and testing notes current.
3. Mark it ready only after the feature works against staging.
4. The contributor who did not author the change reviews the code and tests the
   important workflow.
5. Resolve every review conversation and merge conflict.
6. Squash-merge the pull request into `v2-development`.
7. Delete the feature branch after the merge.
8. Both contributors pull the updated `v2-development` before starting new
   branches.

Neither contributor merges V2 into `main` without an agreed production release,
staging verification, and the release checklist.

## Supabase And Migration Safety

- Never experiment against production first.
- Never copy real production member data into staging.
- Add a new timestamped file under `supabase/migrations/` for every schema or
  RLS change.
- Never edit
  `supabase/migrations/20260816221135_initial_verified_baseline.sql`; it is the
  verified historical baseline.
- Keep the migration, matching application changes, and verification notes in
  the same pull request whenever practical.
- Apply migrations to staging, test all affected roles, and verify facility
  isolation before considering production.
- Record manual Supabase dashboard settings in the repository documentation.
- Do not commit passwords, database connection passwords, access tokens, or
  service-role/secret keys. The Supabase publishable key used by the browser is
  not a replacement for RLS.

## Local Development

The shared local port is `3000`:

```bash
python3 -m http.server 3000
```

Open:

```text
http://localhost:3000/login.html
```

Staging Supabase Auth should allow the exact local password-reset URL used by
the application:

```text
http://localhost:3000/set-password.html
http://127.0.0.1:3000/set-password.html
```

## Minimum Review Checks

- Confirm the feature branch targets `v2-development`, not `main`.
- Review the changed files and any migration line by line.
- Test the primary successful workflow.
- Test loading, empty, validation, permission-denied, and error behavior when
  relevant.
- Test coach and member access when the feature affects both.
- Test two facilities when the feature reads or writes facility data.
- Check mobile and desktop layouts for visible UI changes.
- Confirm no production URL, secret, real member data, or unrelated change was
  introduced.

## Product Scope

Version 2 finalizes the shared multi-facility platform foundation and the core
workout creation, editing, assignment, logging, and history experience. It also
adds shared modules such as goals, leaderboards, notes, notifications, and
profiles.

Version 3 will be the deeper baseball-development expansion. Baseball-specific
metrics, throwing and arm-care programs, player cards, evaluations, recruiting,
and related workflows should not expand V2 unless the roadmap is intentionally
changed by Derek and Sam.
