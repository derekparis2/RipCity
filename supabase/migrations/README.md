# Migrations

Files run in timestamp order and are treated as immutable after successful
staging application.

- `20260816221135_initial_verified_baseline.sql` is for a fresh empty project.
- `20260829140000_add_v2_goals.sql` adds the V2 goal lifecycle, timeline, due
  date, completion timestamp, and creator-aware member/coach permissions.
- `20260830120000_add_goal_checkins.sql` adds facility-safe goal progress
  check-ins and protects their identity fields.
- `20260914140000_add_unilateral_exercise_flags.sql` adds non-null Each Side
  flags to exercise templates and workout snapshots.
- `20260914220000_correct_jump_and_med_ball_exercise_defaults.sql` applies the
  coach-approved Vertical Jump and medicine-ball catalog defaults.
- `20260914223000_apply_approved_exercise_input_audit.sql` applies the remaining
  coach-approved prescribed-distance and Each Side defaults.
- `20261016120000_add_secure_coach_invites.sql` adds seven-day, single-use
  coach invitations, atomic pending-membership claims, and admin-only invite
  management. It does not change reusable member signup links.
- `20261016200000_harden_secure_coach_invites.sql` moves coach-invite secret and
  expiration generation to the database, makes claimed invites irreversible,
  and permits membership-free interrupted signups to retry with a fresh link.
- `20261016201500_lock_down_coach_invite_writes.sql` closes two-step invite
  reopening and reserves direct coach-invite inserts/updates for the trusted
  server-side RPC while preserving existing member-invite table policies.
- `20261018100000_add_targeted_coach_announcements.sql` adds atomic,
  facility-scoped announcements for full-facility, group, and individual
  audiences with optional expiration and recipient-enforced RLS.
- `20261018103000_fix_targeted_announcement_creation.sql` makes the creation
  RPC explicitly facility-scoped and uses its validated server-side transaction
  to bypass the direct-insert policy that rejected every staging coach.
- `20261018110000_add_announcement_audiences_and_dismissals.sql` adds the
  all-athletes audience and private per-member dismissal state used to hide a
  message for the current day.
- `20261018113000_add_h2k_announcement_audience.sql` adds the matching one-click
  all-H2K audience while preserving custom group and individual targeting.
- `20261019190000_restrict_member_lifecycle_to_facility_admins.sql` removes the
  ordinary-coach membership update policy so only facility admins can approve,
  reject, deactivate, reactivate, or change membership roles.
- `20261023120000_add_group_creator_permissions.sql` records group creators and
  restricts coach group/member removal to coach-owned groups while preserving
  full facility-admin management.
- `20261023180000_add_workout_attribution_rpc.sql` exposes creator and assigner
  display names only for workout assignments the signed-in user may view.
- `20261023210000_admin_assign_signup_groups.sql` removes athlete group choice
  from signup permissions and adds facility-admin-only, atomic initial-group
  assignment plus athlete approval enforcement.
- `20261024120000_admin_assign_all_member_signup_groups.sql` extends the same
  matching-group approval requirement and atomic RPC to H2K members.
- `20261024150000_add_member_habit_leaderboards.sql` adds a privacy-safe member
  leaderboard RPC that exposes only the caller's program top-five positions
  plus their own position, with optional caller-owned group scope.
- `20261024170000_add_testing_days_foundation.sql` adds facility-scoped Testing
  Days, ordered test snapshots, deduplicated group/individual participant
  rosters, result-ready storage, and transactional scheduling RPCs. It starts
  with result writes denied; the later staff-result migration grants only the
  approved RPC path.
- `20261024173000_fix_testing_day_save_column_resolution.sql` removes an
  ambiguous `testing_day_id` PL/pgSQL reference that initially prevented the
  transactional Testing Day save RPC from completing.
- `20261024200000_enable_staff_testing_result_entry.sql` adds transactional
  coach/admin result upserts and clearing while preserving direct-write and
  member-entry denial.
- `20261024203000_complete_testing_day_workflow.sql` adds explicit participant
  absence and per-test Not Tested states, member-own result reads, and a guarded
  completion RPC that rejects unexplained missing outcomes.
- `20261025120000_add_versioned_legal_acceptances.sql` adds the current Terms and
  Privacy catalog, append-only per-user acceptance evidence, mutually exclusive
  adult/minor age categories, and guarded status/acceptance RPCs. Apply this
  migration before deploying frontend assets that call either RPC.
- `20261102120000_add_atomic_member_signup_completion.sql` replaces the three
  separate member application-row writes with one authenticated, retry-safe
  transaction. It completes interrupted signups without duplicating membership
  or member-profile rows and must reach staging/production before the matching
  auth frontend is deployed.
- `20261104120000_preserve_announcement_author_names.sql` snapshots the posting
  coach/admin display name on announcements so members see reliable attribution
  without receiving broad access to staff profiles. Apply it before deploying
  frontend assets that select `author_display_name`.
- `20261108150000_add_platform_owner_foundation.sql` adds the private,
  audited platform-owner authorization used by Derek and Sam without granting
  automatic access to facility member data.
- `20261108160000_add_facility_configuration.sql` adds facility time zones,
  lifecycle state, terminology, programs, and module configuration. Existing
  facilities receive the complete current feature set, and only a platform
  owner can replace configuration through the audited RPC.
- `20261108170000_add_facility_aware_signup.sql` adds the safe public facility
  branding/program lookup, facility-branded coach-invite lookup, and a
  facility-aware retry-safe member signup transaction. It preserves old Rip
  City links through the `rip-city` default while new copied links pass their
  facility slug explicitly.
- `20261108180000_add_platform_facility_provisioning.sql` adds atomic,
  platform-owner-only facility creation and explicit audited admin mode.
  Creation saves the full configuration and one normal approved admin
  membership without adding a hidden cross-facility RLS bypass.
- `20261108190000_add_platform_admin_invites.sql` adds owner-only, seven-day,
  single-use first-admin invitations. A claim creates only pending admin access
  in the selected facility and continues through the normal approval workflow.
- Future changes must use a later UTC timestamp and a descriptive name, such as
  `20260817090000_add_facility_timezone.sql`.

Do not rerun the initial baseline over an existing application schema. Do not
edit it to perform an upgrade; add a new migration instead.

## Publishing A New Legal Version

Never edit an already-applied document row or acceptance row. To update either
document:

1. Add a later migration that marks the old row for that document type as not
   current and inserts a new current row with a new version and effective date.
2. Update the matching HTML policy content and its `data-legal-version` value.
3. Apply the migration to staging before deploying the frontend, run the legal
   acceptance staging checks, and verify signup plus an existing account.
4. Apply the same migration to production before the matching `main` frontend
   deploy.

Because an acceptance references the exact current Terms/Privacy pair, changing
either current document automatically requires every account to accept again.
Historical acceptances remain intact.
