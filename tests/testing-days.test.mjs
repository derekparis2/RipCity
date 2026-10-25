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
const resultEntryMigration = await readFile(
  "supabase/migrations/20261024200000_enable_staff_testing_result_entry.sql",
  "utf8"
);
const workflowMigration = await readFile(
  "supabase/migrations/20261024203000_complete_testing_day_workflow.sql",
  "utf8"
);
const coachPage = await readFile("coach-testing.html", "utf8");
const coachScript = await readFile("js/coach/coach-testing.js", "utf8");
const coachNav = await readFile("js/coach/coach-nav.js", "utf8");
const memberPage = await readFile("member-training.html", "utf8");
const memberScript = await readFile("js/member/member-testing-days.js", "utf8");
const memberDashboardScript = await readFile("js/member/member-dashboard.js", "utf8");
const memberDetailPage = await readFile("coach-member-detail.html", "utf8");
const memberDetailScript = await readFile("js/coach/coach-member-detail.js", "utf8");

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
assert.match(resultEntryMigration, /create or replace function public\.save_testing_results/, "staff result entry uses one transactional RPC");
assert.match(resultEntryMigration, /app_private\.is_facility_coach/, "result entry is restricted to facility coaches and admins");
assert.match(resultEntryMigration, /on conflict \(testing_day_test_id, testing_day_participant_id\)/, "both result-entry views upsert one canonical result");
assert.match(workflowMigration, /participation_status/, "Testing Day participants distinguish pending, participated, and absent states");
assert.match(workflowMigration, /result_status/, "Testing results distinguish recorded and not-tested outcomes");
assert.match(workflowMigration, /create policy "members read own testing results"/, "members receive narrow access to only their own official results");
assert.match(workflowMigration, /create or replace function public\.finish_testing_day/, "Testing Days use a guarded completion RPC");
assert.match(workflowMigration, /Record a result, mark Not Tested, or mark the athlete absent/, "Testing Days cannot finish with unexplained missing outcomes");

assert.match(coachNav, /coach-testing\.html/, "coach navigation includes Testing Days");
assert.match(coachPage, /Choose groups and individuals/, "coach builder supports group and individual targeting");
assert.match(coachPage, /data-testing-step="details"[\s\S]*data-testing-step="tests"[\s\S]*data-testing-step="assign"/, "Testing Day builder follows details, tests, then assignment order");
assert.match(coachPage, /data-result-mode="athlete"[\s\S]*data-result-mode="test"/, "staff can enter results athlete-first or test-first");
assert.match(coachPage, /id="testing-target-type"[\s\S]*value="groups"[\s\S]*value="members"[\s\S]*value="both"/, "assignment mirrors the workout builder while supporting groups, members, or both");
assert.match(coachPage, /id="testing-builder-review"/, "Testing Day scheduling includes the workout-builder-style review card");
assert.match(coachScript, /selectedTestingGroupIds/, "coach group selection survives rerenders and searches");
assert.match(coachScript, /selectedTestingMemberIds/, "coach individual selection survives rerenders and searches");
assert.match(coachScript, /from\("testing_test_templates"\)/, "saved facility test definitions return to the reusable builder list");
assert.match(coachScript, /db\.rpc\("save_testing_day"/, "coach builder saves through the transactional RPC");
assert.match(coachScript, /db\.rpc\("save_testing_results"/, "coach result entry saves through the staff RPC");
assert.match(coachScript, /testing-test-drag-handle/, "tests use workout-builder-style drag ordering");
assert.match(coachScript, /function createTestingClientId\(\)/, "Testing Day cards use a mobile-compatible temporary ID helper");
assert.doesNotMatch(coachScript, /definition\.key \|\| crypto\.randomUUID\(\)/, "Testing Day cards do not call crypto.randomUUID directly");
assert.match(coachScript, /db\.rpc\("finish_testing_day"/, "coach UI finishes Testing Days through the guarded RPC");
assert.match(coachScript, /set_testing_participant_status/, "coach UI can explicitly account for absent participants");
assert.match(coachScript, /result_status/, "coach UI can explicitly mark a test Not Tested");
assert.match(coachScript, /data-result-not-tested/, "each athlete/test result has a dedicated did-not-complete checkbox");
assert.match(coachScript, /Did not complete/, "the skipped-test control uses clear general-purpose wording");
assert.match(coachScript, /window\.confirm/, "destructive and publishing Testing Day actions require confirmation");
assert.match(coachScript, /day\.name}[\s\S]*day\.description[\s\S]*date[\s\S]*groups[\s\S]*members[\s\S]*tests/, "Testing Day archive search covers day, date, group, participant, and test details");
assert.match(coachScript, /data-testing-action="view-results"[\s\S]*data-testing-action="edit-results"/, "completed Testing Days support result review and correction");
assert.match(coachScript, /ranking_direction === "lower"/, "test result review respects lower-is-better rankings");
assert.match(coachScript, /row\.numeric !== previousValue/, "equal Testing Day results share a ranking position");

assert.match(memberPage, /id="member-testing-panel"/, "member Training includes an assigned Testing Days section");
assert.ok(memberPage.indexOf('id="member-testing-panel"') > memberPage.indexOf('id="training-calendar-panel"'), "member Testing Days appear below the Training calendar");
assert.match(memberPage, /id="member-testing-search"/, "members can search a longer Testing Day history");
assert.match(memberScript, /testing_day_participants/, "member schedule loads through the snapshotted participant roster");
assert.match(memberScript, /testing_results/, "member schedule renders the signed-in member's official results");
assert.match(memberScript, /FINAL RESULTS/, "completed member Testing Days are clearly labeled as final results");
assert.doesNotMatch(memberScript, /Official results appear here as your coach saves them/, "completed result cards omit the redundant result footer");
assert.match(memberScript, /sort\(\(a, b\) => b\.day\.testing_date\.localeCompare\(a\.day\.testing_date\)\)/, "member Testing Days default to newest date first");
assert.match(memberScript, /data-member-testing-toggle/, "member Testing Day cards can be collapsed");
assert.match(memberScript, /is-collapsed/, "collapsed member Testing Day cards use the compact presentation");
assert.match(memberDetailPage, /id="coach-member-testing-panel"/, "coach member detail includes Testing Day results");
assert.match(memberDetailScript, /testing_day_participants/, "coach member detail loads the member's Testing Day history");
assert.match(memberDetailScript, /coach-testing\.html\?testingDay=/, "member Testing Day summaries link to canonical staff result editing");
assert.match(coachScript, /memberProfileId: params\.get\("member"\)/, "Testing Day deep links focus the selected member");
assert.match(memberDashboardScript, /has-testing-day/, "assigned Testing Days are highlighted on the Training calendar");
assert.match(memberDashboardScript, /testing-label-short">Test Day/, "the mobile calendar uses a compact Testing Day label");
assert.doesNotMatch(memberScript, /insert\(|update\(|upsert\(|save_testing_results/, "member Testing Day schedule has no result write flow");

console.log("Testing Day foundation tests passed");
