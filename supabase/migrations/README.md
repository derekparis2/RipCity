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
  rosters, result-ready storage, and transactional scheduling RPCs. Result
  writes intentionally remain denied until the official-entry role is approved.
- `20261024173000_fix_testing_day_save_column_resolution.sql` removes an
  ambiguous `testing_day_id` PL/pgSQL reference that initially prevented the
  transactional Testing Day save RPC from completing.
- Future changes must use a later UTC timestamp and a descriptive name, such as
  `20260817090000_add_facility_timezone.sql`.

Do not rerun the initial baseline over an existing application schema. Do not
edit it to perform an upgrade; add a new migration instead.
