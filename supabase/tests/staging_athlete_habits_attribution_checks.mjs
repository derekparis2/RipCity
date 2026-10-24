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
  const text = await response.text();
  let body = [];
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
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

const [ripCoach, ripAthlete, alphaAthlete] = await Promise.all([
  signIn("rccoach@example.com", password),
  signIn("rcathlete@example.com", password),
  signIn("alphaathlete@example.com", password)
]);

const { body: athleteMemberships } = await request(
  `facility_members?select=id&profile_id=eq.${ripAthlete.userId}`,
  ripAthlete.token
);
const membershipId = athleteMemberships[0]?.id;
const { body: athleteProfiles } = await request(
  `member_profiles?select=id,member_type&facility_member_id=eq.${membershipId}`,
  ripAthlete.token
);
const athleteProfile = athleteProfiles[0];
assert(athleteProfile?.member_type === "athlete", "Rip City athlete fixture is available");

const { body: habits } = await request(
  "habits?select=id,name&active=eq.true&order=name.asc",
  ripAthlete.token
);
assert(habits.length > 0, "athlete can read the facility habit list");

const testDate = "2001-01-01";
try {
  const habitWrite = await request("habit_logs?on_conflict=member_profile_id,habit_id,log_date&select=id", ripAthlete.token, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      member_profile_id: athleteProfile.id,
      habit_id: habits[0].id,
      log_date: testDate,
      completed: true,
      points_earned: 1
    })
  });
  assert(habitWrite.response.ok && Boolean(habitWrite.body[0]?.id), "athlete can save their own habit result");

  const { body: assignments } = await request(
    "workout_assignments?select=id&order=assigned_date.desc&limit=1",
    ripAthlete.token
  );
  const assignmentId = assignments[0]?.id;
  assert(Boolean(assignmentId), "athlete has a visible staging workout assignment");

  const attribution = await request("rpc/get_workout_attributions", ripAthlete.token, {
    method: "POST",
    body: JSON.stringify({ check_assignment_ids: [assignmentId] })
  });
  assert(
    attribution.response.ok &&
      attribution.body[0]?.workout_creator_name &&
      attribution.body[0]?.assignment_assigner_name,
    "athlete can read creator and assigner names for an authorized workout"
  );

  const deniedAttribution = await request("rpc/get_workout_attributions", alphaAthlete.token, {
    method: "POST",
    body: JSON.stringify({ check_assignment_ids: [assignmentId] })
  });
  assert(
    deniedAttribution.response.ok && deniedAttribution.body.length === 0,
    "member from another facility cannot read workout attribution"
  );

  const { body: coachAssignments } = await request(
    `workout_assignments?select=id&id=eq.${assignmentId}`,
    ripCoach.token
  );
  assert(
    coachAssignments[0]?.id === assignmentId,
    "facility coach can see the athlete's shared facility assignment"
  );
} finally {
  await request(
    `habit_logs?member_profile_id=eq.${athleteProfile.id}&habit_id=eq.${habits[0].id}&log_date=eq.${testDate}`,
    ripAthlete.token,
    { method: "DELETE" }
  );
}

console.log("Athlete-habit and workout-attribution staging checks passed and fixtures were cleaned up.");
