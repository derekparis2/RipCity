import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const auth = await readFile("js/auth/auth.js", "utf8");
const access = await readFile("js/shared/access-control.js", "utf8");
const approvals = await readFile("js/coach/coach-approvals.js", "utf8");
const migration = await readFile(
  "supabase/migrations/20261102120000_add_atomic_member_signup_completion.sql",
  "utf8"
);
const signupPage = await readFile("signup.html", "utf8");
const loginPage = await readFile("login.html", "utf8");
const approvalsPage = await readFile("coach-approvals.html", "utf8");

assert.match(migration, /create or replace function public\.complete_member_signup/);
assert.match(migration, /security definer/);
assert.match(migration, /requester_id uuid := auth\.uid\(\)/);
assert.match(migration, /insert into public\.facility_members[\s\S]*on conflict \(facility_id, profile_id\) do nothing/);
assert.match(migration, /insert into public\.member_profiles[\s\S]*on conflict do nothing/);
assert.match(migration, /grant execute on function public\.complete_member_signup[\s\S]*to authenticated/);

assert.match(auth, /db\.rpc\("complete_member_signup"/);
assert.doesNotMatch(auth, /\.from\("facility_members"\)\s*\.insert/);
assert.doesNotMatch(auth, /\.from\("member_profiles"\)\s*\.insert/);
assert.match(auth, /signupInProgress/);
assert.match(auth, /loginInProgress/);
assert.match(auth, /AUTH_REQUEST_TIMEOUT_MS = 15000/);
assert.match(auth, /function createAuthAttempt\(/);
assert.match(auth, /async function recoverAuthenticatedUser\(/);
assert.match(auth, /Too many account emails were requested/);
assert.match(access, /DEFAULT_REQUEST_TIMEOUT_MS = 15000/);
assert.match(access, /deniedUrl = "member-dashboard\.html"/);
assert.match(access, /window\.location\.replace\(deniedUrl\)/);
assert.match(approvals, /approvalLoadInProgress/);
assert.match(approvals, /Loading approvals took too long/);

for (const page of [signupPage, loginPage]) {
  assert.match(page, /auth\.js\?v=auth-reliability-2/);
}
assert.match(approvalsPage, /access-control\.js\?v=auth-reliability-2/);
assert.match(approvalsPage, /coach-approvals\.js\?v=auth-reliability-1/);

console.log("Auth reliability tests passed");
