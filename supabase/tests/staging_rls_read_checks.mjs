import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";
const ALPHA_FACILITY_ID = "00000000-0000-4000-8000-000000000002";

const scenarios = [
  { email: "rcadmin@example.com", memberships: 6, profiles: 6, memberProfiles: 4, habits: 6, facilities: "rip" },
  { email: "rccoach@example.com", memberships: 10, profiles: 9, memberProfiles: 5, habits: 6, facilities: "both" },
  { email: "rcathlete@example.com", memberships: 1, profiles: 1, memberProfiles: 1, habits: 6, facilities: "rip" },
  { email: "rch2k@example.com", memberships: 1, profiles: 1, memberProfiles: 1, habits: 6, facilities: "rip" },
  { email: "rcpending@example.com", memberships: 1, profiles: 1, memberProfiles: 1, habits: 0, facilities: "rip" },
  { email: "rcinactive@example.com", memberships: 1, profiles: 1, memberProfiles: 1, habits: 0, facilities: "rip" },
  { email: "alphaadmin@example.com", memberships: 4, profiles: 4, memberProfiles: 1, habits: 0, facilities: "alpha" },
  { email: "alphacoach@example.com", memberships: 4, profiles: 4, memberProfiles: 1, habits: 0, facilities: "alpha" },
  { email: "alphaathlete@example.com", memberships: 1, profiles: 1, memberProfiles: 1, habits: 0, facilities: "alpha" }
];

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${email} login failed (${response.status}): ${body.msg || body.error_description || "unknown error"}`);
  }

  return body.access_token;
}

async function readRows(path, accessToken = PUBLISHABLE_KEY) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`GET ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

function allowedFacilityIds(scope, ripFacilityId) {
  if (scope === "both") return new Set([ripFacilityId, ALPHA_FACILITY_ID]);
  if (scope === "alpha") return new Set([ALPHA_FACILITY_ID]);
  return new Set([ripFacilityId]);
}

function addCheck(results, email, check, expected, actual, passed) {
  results.push({
    account: email.replace("@example.com", ""),
    check,
    expected: String(expected),
    actual: String(actual),
    result: passed ? "PASS" : "FAIL"
  });
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();

if (!password) {
  throw new Error("A staging test password is required.");
}

const ripFacilities = await readRows("facilities?select=id,slug&slug=eq.rip-city");

if (ripFacilities.length !== 1) {
  throw new Error(`Expected one public Rip City signup facility, found ${ripFacilities.length}.`);
}

const ripFacilityId = ripFacilities[0].id;
const results = [];

for (const scenario of scenarios) {
  const accessToken = await signIn(scenario.email, password);
  const [memberships, profiles, memberProfiles, habits] = await Promise.all([
    readRows("facility_members?select=facility_id,role,status", accessToken),
    readRows("profiles?select=id,email,global_role", accessToken),
    readRows("member_profiles?select=id,facility_member_id,member_type", accessToken),
    readRows("habits?select=id,facility_id,name", accessToken)
  ]);

  const allowedIds = allowedFacilityIds(scenario.facilities, ripFacilityId);
  const visibleMembershipFacilityIds = new Set(memberships.map(row => row.facility_id));
  const membershipScopePassed = [...visibleMembershipFacilityIds].every(id => allowedIds.has(id));

  addCheck(results, scenario.email, "membership rows", scenario.memberships, memberships.length, memberships.length === scenario.memberships);
  addCheck(results, scenario.email, "membership facility scope", allowedIds.size, visibleMembershipFacilityIds.size, membershipScopePassed);
  addCheck(results, scenario.email, "profile rows", scenario.profiles, profiles.length, profiles.length === scenario.profiles);
  addCheck(results, scenario.email, "member-profile rows", scenario.memberProfiles, memberProfiles.length, memberProfiles.length === scenario.memberProfiles);
  addCheck(results, scenario.email, "habit rows", scenario.habits, habits.length, habits.length === scenario.habits);
}

console.table(results);

const failures = results.filter(row => row.result === "FAIL");

if (failures.length) {
  console.error(`\n${failures.length} RLS read check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${results.length} staging RLS read checks passed.`);
}
