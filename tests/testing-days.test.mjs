import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  "supabase/migrations/20261024170000_add_testing_days_foundation.sql",
  "utf8"
);
const saveFixMigration = await readFile(
  "supabase/migrations/20261024173000_fix_testing_day_save_column_resolution.sql",
  "utf8"
);
const coachPage = await readFile("coach-testing.html", "utf8");
const coachScript = await readFile("js/coach/coach-testing.js", "utf8");
const coachNav = await readFile("js/coach/coach-nav.js", "utf8");
const memberPage = await readFile("member-training.html", "utf8");
const memberScript = await readFile("js/member/member-testing-days.js", "utf8");

for (const table of [
  "testing_test_templates",
  "testing_days",
  "testing_day_tests",
  "testing_day_groups",
  "testing_day_participants",
  "testing_results"
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} is created by the Testing Day migration`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
}

assert.match(migration, /create or replace function public\.save_testing_day/, "Testing Days use a transactional save RPC");
assert.match(migration, /select distinct unnest\(normalized_group_ids\)/, "selected groups are deduplicated");
assert.match(migration, /group by candidates\.member_profile_id/, "overlapping group and individual recipients produce one participant");
assert.match(migration, /A Testing Day with saved results cannot be restructured/, "result-bearing Testing Days cannot be restructured");
assert.match(migration, /create trigger require_testing_result_same_day/, "results cannot mix tests and participants from different Testing Days");
assert.doesNotMatch(migration, /create policy[^;]*testing_results[^;]*for (insert|update|delete)/is, "no authenticated result-write policy exists before the role decision");
assert.match(migration, /revoke insert, update, delete on public\.testing_results from authenticated/, "direct result writes are explicitly revoked");
assert.match(saveFixMigration, /#variable_conflict use_column/, "Testing Day saves resolve table columns instead of conflicting output variables");
assert.match(saveFixMigration, /pg_get_functiondef/, "the staging fix preserves the already-applied transactional save function");

assert.match(coachNav, /coach-testing\.html/, "coach navigation includes Testing Days");
assert.match(coachPage, /Choose groups and individuals/, "coach builder supports group and individual targeting");
assert.match(coachScript, /selectedTestingGroupIds/, "coach group selection survives rerenders and searches");
assert.match(coachScript, /selectedTestingMemberIds/, "coach individual selection survives rerenders and searches");
assert.match(coachScript, /from\("testing_test_templates"\)/, "saved facility test definitions return to the reusable builder list");
assert.match(coachScript, /db\.rpc\("save_testing_day"/, "coach builder saves through the transactional RPC");

assert.match(memberPage, /id="member-testing-panel"/, "member Training includes an assigned Testing Days section");
assert.match(memberScript, /testing_day_participants/, "member schedule loads through the snapshotted participant roster");
assert.doesNotMatch(memberScript, /from\("testing_results"\)|insert\(|update\(|upsert\(/, "member Testing Day schedule has no result read or write flow");

console.log("Testing Day foundation tests passed");
