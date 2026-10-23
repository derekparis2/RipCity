import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const approvals = await readFile("js/coach/coach-approvals.js", "utf8");
const roster = await readFile("js/coach/coach-roster.js", "utf8");
const migration = await readFile(
  "supabase/migrations/20261019190000_restrict_member_lifecycle_to_facility_admins.sql",
  "utf8"
);
const groupMigration = await readFile(
  "supabase/migrations/20261023120000_add_group_creator_permissions.sql",
  "utf8"
);

assert.match(
  approvals,
  /const canDecide = access\.isAdmin;/,
  "only facility admins receive approval controls"
);
assert.match(
  approvals,
  /if \(!access\.isAdmin\)[\s\S]*Only a facility administrator can approve or reject member access/,
  "approval writes have an admin guard"
);
assert.match(
  roster,
  /const lifecycleAction = rosterAccess\?\.isAdmin/,
  "member lifecycle controls render only for facility admins"
);
assert.match(
  roster,
  /if \(!rosterAccess\?\.isAdmin\)[\s\S]*Only a facility administrator can change member account access/,
  "roster lifecycle writes have an admin guard"
);
assert.match(
  migration,
  /drop policy if exists "facility_members coaches can update non coach rows"/,
  "migration removes the ordinary-coach membership update policy"
);
assert.doesNotMatch(
  migration,
  /drop policy if exists "facility_members admins can update facility rows"/,
  "migration preserves the facility-admin update policy"
);
assert.match(
  roster,
  /function canManageRosterGroup\(group\)[\s\S]*rosterAccess\?\.isAdmin[\s\S]*group\.created_by === rosterAccess\?\.profile\?\.id/,
  "roster lets admins or the creating coach remove groups"
);
assert.match(
  roster,
  /created_by: rosterAccess\.profile\.id/,
  "new roster groups record their creator"
);
assert.match(
  groupMigration,
  /add column if not exists created_by uuid references public\.profiles/,
  "group migration records the creator"
);
assert.match(
  groupMigration,
  /groups coaches can delete owned facility groups/,
  "group deletion policy is ownership-aware"
);
assert.match(
  groupMigration,
  /group_members coaches can delete owned group memberships/,
  "group-member removal policy is ownership-aware"
);

console.log("Admin-only member lifecycle tests passed");
