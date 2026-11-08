import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";

async function request(path, token = PUBLISHABLE_KEY, options = {}) {
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
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function rpc(name, body, token = PUBLISHABLE_KEY) {
  return request(`rpc/${name}`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${email} login failed: ${body?.msg || body?.error_description}`);
  return { token: body.access_token, userId: body.user.id };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

for (const slug of ["rip-city", "test-facility-alpha"]) {
  const lookup = await rpc("lookup_signup_facility", { p_facility_slug: slug });
  assert(lookup.response.ok && lookup.body?.facility_slug === slug, `${slug} is available to the public signup lookup`);
  assert(Array.isArray(lookup.body?.programs) && lookup.body.programs.length === 2, `${slug} returns its configured programs`);
  assert(!("settings" in lookup.body), `${slug} public signup data omits private module settings`);
}

const unknown = await rpc("lookup_signup_facility", { p_facility_slug: "not-a-real-facility" });
assert(unknown.response.ok && unknown.body === null, "unknown facility slugs do not expose a signup destination");

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const account = await signIn("rcpending@example.com", password);
const { body: profiles } = await request(
  `profiles?select=id,full_name,username&id=eq.${account.userId}`,
  account.token
);
const { body: memberships } = await request(
  `facility_members?select=id,facility_id&profile_id=eq.${account.userId}`,
  account.token
);
const membership = memberships?.[0];
const { body: memberProfiles } = await request(
  `member_profiles?select=id,member_type,sport,position,school,graduation_year,body_weight&facility_member_id=eq.${membership?.id}`,
  account.token
);
const profile = profiles?.[0];
const memberProfile = memberProfiles?.[0];
assert(Boolean(profile && membership && memberProfile), "pending Rip City signup fixture is available");

const input = {
  p_full_name: profile.full_name,
  p_username: profile.username,
  p_member_type: memberProfile.member_type,
  p_sport: memberProfile.sport,
  p_position: memberProfile.position,
  p_school: memberProfile.school,
  p_graduation_year: memberProfile.graduation_year,
  p_body_weight: memberProfile.body_weight,
  p_facility_slug: "rip-city"
};
const retry = await rpc("complete_member_signup", input, account.token);
assert(retry.response.ok, "member signup retry completes inside its existing facility");
assert(retry.body?.[0]?.facility_member_id === membership.id, "facility-aware retry preserves the membership row");
assert(retry.body?.[0]?.member_profile_id === memberProfile.id, "facility-aware retry preserves the member profile row");

const crossFacility = await rpc(
  "complete_member_signup",
  { ...input, p_facility_slug: "test-facility-alpha" },
  account.token
);
assert(!crossFacility.response.ok, "member signup cannot attach an existing account to another facility");

console.log("Facility-aware signup staging checks passed.");
