# Staging Test Accounts

These accounts are entirely fake and belong only to **Rip City Staging**. Never
create them in production or replace them with real member information.

The shared staging password is stored privately by Derek and Sam. Do not commit
it, paste it into documentation, or reuse it for production/personal accounts.

| Email | Facility | Role | Status | Test purpose |
| --- | --- | --- | --- | --- |
| `rcadmin@example.com` | Rip City | Admin | Approved | Full facility-admin workflows |
| `rccoach@example.com` | Rip City | Coach | Approved | Normal Rip City coaching workflows |
| `rcathlete@example.com` | Rip City | Athlete | Approved | Approved athlete experience |
| `rch2k@example.com` | Rip City | H2K member | Approved | H2K habits and member experience |
| `rcpending@example.com` | Rip City | Athlete | Pending | Pending-access denial and approval |
| `rcinactive@example.com` | Rip City | Athlete | Inactive | Deactivation and reactivation history |
| `alphaadmin@example.com` | Test Facility Alpha | Admin | Approved | Second-facility administration |
| `alphacoach@example.com` | Test Facility Alpha | Coach | Approved | Second-facility coaching workflows |
| `alphaathlete@example.com` | Test Facility Alpha | Athlete | Approved | Second-facility member isolation |

Future multi-facility and platform-owner test scenarios belong to
`VERSION_3_PLAN.md`. Do not add a platform-owner identity to the V2 fixture.

Status: all nine Auth identities were created, auto-confirmed, and connected to
their application profiles/memberships in Rip City Staging on 2026-08-28. The
fixture originally returned ten membership rows. The obsolete Alpha membership
for `rccoach@example.com` was removed on 2026-10-18; the maintained fixture now
contains nine one-facility memberships.

## Display-Only Leaderboard Members

`supabase/seeds/staging/v2/03_leaderboard_demo_data.sql` adds ten additional
fake display-only members: five H2K members and five athletes. These rows do not
have Supabase Auth identities and cannot log in. They exist to test six-person
leaderboards, tied ranks, different streaks, different attendance percentages,
and no-score/no-assignment behavior without maintaining ten more passwords.

Use `rch2k@example.com` and `rcathlete@example.com` to test the member-facing
version of the same seeded metrics. Rerun the fixture when the relative dates
need to be refreshed for a new testing week.

## Manual Smoke Test Status

Verified on 2026-08-28:

- Rip City admin reached the coach experience and saw Rip City data.
- Test Facility Alpha admin saw only Alpha Test Athlete; no Rip City member data
  appeared.
- Test Facility Alpha athlete saw the member experience without H2K habits.
- Rip City H2K member saw the six Rip City habits.
- Rip City athlete did not see H2K member UI.
- Pending and inactive members were blocked from normal application access.

Known UI gaps confirmed by this test:

- Test Facility Alpha still displays hardcoded Rip City branding.
- Inactive members receive the generic pending-account message.
The repeatable read-only suite in
`supabase/tests/staging_rls_read_checks.mjs` covers both one-facility datasets
without requiring a multi-facility V2 account.

## Safety Rules

- Use these accounts only against the staging Supabase project.
- Keep all profile, workout, goal, note, and upload content obviously fake.
- Use no uploaded videos and few or no profile pictures.
- Do not give these credentials to outside testers.
- Change the shared password before staging is made broadly accessible.
