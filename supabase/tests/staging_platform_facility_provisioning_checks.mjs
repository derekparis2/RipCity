import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";
const REHEARSAL_SLUG = "platform-launch-rehearsal";

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
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

function rpc(name, token, body = {}) {
  return request(`rpc/${name}`, token, { method: "POST", body: JSON.stringify(body) });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [platformOwner, facilityAdmin, alphaMember] = await Promise.all([
  signIn("rcplatform@example.com", password),
  signIn("alphaadmin@example.com", password),
  signIn("alphaathlete@example.com", password)
]);

const modules = ["workouts", "habits", "goals", "leaderboards", "announcements", "testing_days"]
  .map((module_key) => ({ module_key, enabled: true, settings: {} }));
const programs = [
  { program_key: "athlete", display_name: "Athlete", plural_name: "Athletes", enabled: true, sort_order: 10 },
  { program_key: "h2k", display_name: "H2K Member", plural_name: "H2K Members", enabled: true, sort_order: 20 }
];
const terminology = {
  member_singular: "Athlete", member_plural: "Athletes",
  coach_singular: "Coach", coach_plural: "Coaches",
  group_singular: "Group", group_plural: "Groups"
};

const deniedCreate = await rpc("create_platform_facility", facilityAdmin.token, {
  p_name: "Denied Facility", p_slug: "denied-facility", p_logo_url: null,
  p_primary_color: "#111827", p_secondary_color: "#60A5FA",
  p_time_zone: "America/New_York", p_terminology: terminology,
  p_modules: modules, p_programs: programs
});
assert(!deniedCreate.response.ok, "facility admin cannot create a platform facility");

let facilities = await rpc("list_platform_facilities", platformOwner.token);
assert(facilities.response.ok, "platform owner can load the facility directory before provisioning");
let rehearsal = facilities.body.find((facility) => facility.facility_slug === REHEARSAL_SLUG);

if (!rehearsal) {
  const created = await rpc("create_platform_facility", platformOwner.token, {
    p_name: "Platform Launch Rehearsal", p_slug: REHEARSAL_SLUG, p_logo_url: null,
    p_primary_color: "#111827", p_secondary_color: "#60A5FA",
    p_time_zone: "America/Chicago", p_terminology: terminology,
    p_modules: modules, p_programs: programs
  });
  assert(created.response.ok, "platform owner can atomically create a configured facility");
  facilities = await rpc("list_platform_facilities", platformOwner.token);
  rehearsal = facilities.body.find((facility) => facility.facility_slug === REHEARSAL_SLUG);
} else {
  assert(true, "repeat run reuses the existing launch-rehearsal facility");
}

assert(Boolean(rehearsal), "new facility appears in the platform directory");
const configuration = await rpc("get_facility_configuration", platformOwner.token, { p_facility_id: rehearsal.facility_id });
assert(configuration.response.ok, "platform owner can read the new facility configuration");
assert(configuration.body.time_zone === "America/Chicago", "new facility preserves its IANA time zone");
assert(configuration.body.modules.length === 6, "new facility receives every selected module");
assert(configuration.body.programs.length === 2, "new facility receives both member programs");

const deniedAdminMode = await rpc("enter_platform_facility_admin", facilityAdmin.token, { p_facility_id: rehearsal.facility_id });
assert(!deniedAdminMode.response.ok, "ordinary facility admin cannot enter another facility admin mode");
const deniedMemberRead = await rpc("get_facility_configuration", alphaMember.token, { p_facility_id: rehearsal.facility_id });
assert(!deniedMemberRead.response.ok, "member cannot read another facility configuration");

const adminMode = await rpc("enter_platform_facility_admin", platformOwner.token, { p_facility_id: rehearsal.facility_id });
assert(adminMode.response.ok, "platform owner can explicitly enter the new facility admin mode");
const ownerMembership = await request(
  `facility_members?select=id,role,status,facility_id&facility_id=eq.${rehearsal.facility_id}&profile_id=eq.${platformOwner.userId}`,
  platformOwner.token
);
assert(
  ownerMembership.response.ok && ownerMembership.body.length === 1
    && ownerMembership.body[0].role === "admin" && ownerMembership.body[0].status === "approved",
  "admin mode uses one explicit approved facility membership"
);

const crossFacilityProfiles = await request("profiles?select=id&limit=1", alphaMember.token);
assert(
  !crossFacilityProfiles.response.ok || crossFacilityProfiles.body.every((row) => row.id === alphaMember.userId),
  "member does not receive unrelated profiles while the new facility exists"
);

console.log("Platform facility provisioning staging checks passed; rehearsal facility was retained for launch testing.");
