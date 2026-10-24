import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const signupPage = await readFile("signup.html", "utf8");
const auth = await readFile("js/auth/auth.js", "utf8");
const approvals = await readFile("js/coach/coach-approvals.js", "utf8");
const migration = await readFile(
  "supabase/migrations/20261023210000_admin_assign_signup_groups.sql",
  "utf8"
);

assert.doesNotMatch(
  signupPage,
  /signup-training-group/,
  "athlete signup does not ask the member to choose a training group"
);
assert.doesNotMatch(
  auth,
  /trainingGroupId|signupGroups|loadSignupGroups|renderSignupGroups/,
  "signup JavaScript no longer loads or assigns athlete groups"
);
assert.match(
  approvals,
  /data-approval-group=/,
  "facility admins receive an initial athlete group selector"
);
assert.match(
  approvals,
  /db\.rpc\("approve_pending_athlete"/,
  "athlete approvals use the transactional database operation"
);
assert.match(
  migration,
  /drop policy if exists "group_members users can insert own signup group membership"/,
  "pending athletes lose self-assignment permission"
);
assert.match(
  migration,
  /app_private\.is_facility_admin\(target_membership\.facility_id\)/,
  "the athlete approval operation requires a facility admin"
);
assert.match(
  migration,
  /insert into public\.group_members[\s\S]*update public\.facility_members/,
  "the database operation assigns the group before approving the athlete"
);
assert.match(
  migration,
  /create trigger require_athlete_group_before_approval/,
  "the database blocks athlete approval without a training group"
);

console.log("Admin-assigned signup group tests passed");

