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

`rccoach@example.com` will also receive an approved coach membership in Test
Facility Alpha. This is the legitimate multi-facility coach scenario.

The platform-owner scenario is intentionally deferred. The verified baseline
does not yet allow `platform_owner` in `profiles.global_role`; add and test that
role through a reviewed V2 migration before creating its test account.

Status: all nine Auth identities were created, auto-confirmed, and connected to
their application profiles/memberships in Rip City Staging on 2026-08-28. The
fixture returned the expected ten membership rows.

## Manual Smoke Test Status

Verified on 2026-08-28:

- Rip City admin reached the coach experience and saw Rip City data.
- Test Facility Alpha admin saw only Alpha Test Athlete; no Rip City member data
  appeared.
- Test Facility Alpha athlete saw the member experience without H2K habits.
- Rip City H2K member saw the six Rip City habits.
- Rip City athlete did not see H2K member UI.
- Pending and inactive members were blocked from normal application access.
- The cross-facility coach currently defaults to Rip City.

Known UI gaps confirmed by this test:

- Test Facility Alpha still displays hardcoded Rip City branding.
- Inactive members receive the generic pending-account message.
- Multi-facility accounts do not yet have a facility selector.

The repeatable read-only suite in
`supabase/tests/staging_rls_read_checks.mjs` passed all 45 checks on 2026-08-28,
including one-facility and two-facility scope counts.

## Safety Rules

- Use these accounts only against the staging Supabase project.
- Keep all profile, workout, goal, note, and upload content obviously fake.
- Use no uploaded videos and few or no profile pictures.
- Do not give these credentials to outside testers.
- Change the shared password before staging is made broadly accessible.
