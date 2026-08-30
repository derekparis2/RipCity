import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${email} login failed: ${body.msg || body.error_description}`);
  return { token: body.access_token, userId: body.user.id };
}

async function request(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const body = response.status === 204 ? [] : await response.json();
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [athleteAuth, coachAuth, alphaCoachAuth] = await Promise.all([
  signIn("rcathlete@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("alphacoach@example.com", password)
]);

const { body: athleteProfiles } = await request("member_profiles?select=id", athleteAuth.token);
assert(athleteProfiles.length === 1, "athlete can identify only their own member profile");
const athleteProfileId = athleteProfiles[0].id;
let memberGoalId;
let coachGoalId;

try {
  const memberCreate = await request("goals?select=id,name,source", athleteAuth.token, {
    method: "POST",
    body: JSON.stringify({
      member_profile_id: athleteProfileId,
      created_by: athleteAuth.userId,
      source: "member",
      name: "Staging member goal",
      timeline: "short_term"
    })
  });
  if (!memberCreate.response.ok) {
    throw new Error(`member goal creation failed (${memberCreate.response.status}): ${JSON.stringify(memberCreate.body)}`);
  }
  assert(memberCreate.response.ok && memberCreate.body.length === 1, "member can create an own goal");
  memberGoalId = memberCreate.body[0].id;

  const memberEdit = await request(`goals?id=eq.${memberGoalId}`, athleteAuth.token, {
    method: "PATCH", body: JSON.stringify({ name: "Updated staging member goal" })
  });
  assert(memberEdit.response.ok && memberEdit.body[0]?.name === "Updated staging member goal", "member can edit an own goal");

  const coachCreate = await request("goals?select=id", coachAuth.token, {
    method: "POST",
    body: JSON.stringify({ member_profile_id: athleteProfileId, created_by: coachAuth.userId, source: "coach", name: "Staging coach goal", timeline: "medium_term" })
  });
  assert(coachCreate.response.ok && coachCreate.body.length === 1, "coach can create a facility-member goal");
  coachGoalId = coachCreate.body[0].id;

  const statusUpdate = await request(`goals?id=eq.${coachGoalId}`, athleteAuth.token, {
    method: "PATCH", body: JSON.stringify({ status: "completed" })
  });
  assert(statusUpdate.response.ok && statusUpdate.body[0]?.completed_at, "member can complete a coach-created goal");

  const forbiddenEdit = await request(`goals?id=eq.${coachGoalId}`, athleteAuth.token, {
    method: "PATCH", body: JSON.stringify({ name: "Not allowed" })
  });
  assert(!forbiddenEdit.response.ok, "member cannot edit coach-created goal fields");

  const ownDelete = await request(`goals?id=eq.${memberGoalId}`, athleteAuth.token, { method: "DELETE" });
  assert(ownDelete.response.ok && ownDelete.body.length === 1, "member can delete an own goal");
  memberGoalId = null;

  const alphaWrite = await request("goals?select=id", alphaCoachAuth.token, {
    method: "POST",
    body: JSON.stringify({ member_profile_id: athleteProfileId, source: "coach", name: "Cross-facility goal", timeline: "short_term" })
  });
  assert(!alphaWrite.response.ok, "other-facility coach cannot create a goal for this member");
} finally {
  if (memberGoalId) await request(`goals?id=eq.${memberGoalId}`, coachAuth.token, { method: "DELETE" });
  if (coachGoalId) await request(`goals?id=eq.${coachGoalId}`, coachAuth.token, { method: "DELETE" });
}

console.log("Goals staging RLS checks passed.");