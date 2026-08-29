# Seeds

Keep seed data separate from schema migrations whenever practical.

- Required configuration must be deterministic and safe to recreate.
- Staging/test seeds must be unmistakably fake.
- Never copy real members, Auth identities, workout logs, notes, or other
  production activity into staging.
- Mutable facility content belongs in production backups unless it is
  intentionally promoted into maintained default configuration.

The verified initial baseline currently includes the original required Rip City
configuration.

## Current Staging Seed

Staging-only fixtures live under versioned folders and must never be included in
a production release. The current V2 order is:

1. `staging/v2/01_two_facility_foundation.sql`
2. Create the nine fake Auth identities documented in
   `docs/STAGING_TEST_ACCOUNTS.md`.
3. `staging/v2/02_test_account_profiles.sql`

`01_two_facility_foundation.sql` adds one unmistakably fake second facility and
two fake athlete groups. Run it only in **Rip City Staging**, after the verified
baseline and before creating fake Auth users.

The seed contains a fail-closed guard. It requires the exact empty baseline
shape, including zero Auth users, zero application profiles, the Rip City
facility, and 87 starter exercises. It aborts instead of writing if those safety
conditions do not match.

The fake second facility intentionally receives no H2K habits. H2K remains a
Rip City-specific module, and this scenario helps prove that it does not leak
into another facility.

Status: successfully applied and verified in Rip City Staging on 2026-08-28.

`02_test_account_profiles.sql` is the next staging-only fixture. After the
nine fake, auto-confirmed Auth identities in `docs/STAGING_TEST_ACCOUNTS.md`
exist, it creates their application profiles, facility roles/statuses, member
profiles, group memberships, and the cross-facility coach scenario. It resolves
Auth IDs by fake email and stores no password.

Status: successfully applied and verified in Rip City Staging on 2026-08-28.
The result is nine application profiles and ten facility memberships.
