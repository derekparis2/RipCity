# Facility platform review and staging verification

2026-11-17: merged `origin/v3-development` into `derek/facility-platform`
(commit `35bdeef`). All 22 local test files pass after review fixes.

## Review coverage

All 14 comments supplied in four screenshots have local changes:

- Escape configurable program labels in approvals and member leaderboards.
- Preserve module settings when editing configuration.
- Update the signup controller version expectation (completed during merge).
- Remove the legacy direct membership insertion policy.
- Gate workout and Testing Day panels and queries separately.
- Keep approved users of archived facilities on the account-status page.
- Initialize workout date and calendar month after facility configuration loads.
- Grant authenticated callers execution of the boolean owner RLS helper.
- Seed six facility-scoped habit definitions when habits are first enabled.
- Add audited support exit, restoring prior membership or removing a temporary
  grant. Repeated entry preserves the baseline; returning to Platform or logging
  out invokes exit. This is explicit revocation, not timed expiration.
- Stop component display rules from overriding the HTML hidden attribute.
- Preserve the claimed invite facility across pending and approved routing.
- Derive the coach week from the facility date.

No earlier migration was edited. The new forward-only migration is
`supabase/migrations/20261117120000_harden_facility_onboarding.sql`.
Apply it to staging after the five existing facility-platform migrations
(`20261108150000` through `20261108190000`, using their facility/platform names).
The workout branch also has a `20261108170000` migration; keep the full filenames
when identifying these prerequisites. This repository has duplicate timestamp
prefixes and currently uses the manual SQL Editor workflow.

## Staging verification

The new SQL has not yet been executed or behavior-tested against PostgreSQL.
Run the existing focused suites with the private staging password:

```bash
node supabase/tests/staging_platform_owner_foundation_checks.mjs
node supabase/tests/staging_facility_configuration_checks.mjs
node supabase/tests/staging_facility_signup_checks.mjs
node supabase/tests/staging_platform_facility_provisioning_checks.mjs
node supabase/tests/staging_platform_admin_invite_checks.mjs
```

Provisioning checks now verify starter habits, direct module reads, repeated
support entry, and restoration/removal on exit. The fake rehearsal facility is
retained. No real facility or real invite recipient should be used for these tests.

In the staging browser, verify:

1. Edit branding without losing existing module settings.
2. Create a fake facility and onboard its first admin through an invite.
3. From an account with another membership, claim the invite and remain in the
   invited facility before and after approval.
4. Enable workouts alone, Testing Days alone, and neither. Verify panel visibility,
   direct-page behavior, and absence of requests for the disabled feature.
5. Archive the fake facility and verify its approved member sees an inactive
   status page rather than a redirect loop.
6. Enter support, return through Exit Admin Mode, then confirm the temporary
   membership is removed or the previous role/status is restored. Repeat via logout.
7. Check dates around facility midnight and a Sunday/Monday boundary using a
   browser time zone different from the facility.
8. Confirm other-facility members cannot read the new facility's private data.

Remaining release gates: live staging checks, fresh review, and separately
coordinated production migrations/deployment. Do not treat local source checks
as evidence of successful database execution.
