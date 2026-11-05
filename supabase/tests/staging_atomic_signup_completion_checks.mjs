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
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function rpc(name, token, body) {
  return request(`rpc/${name}`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const account = await signIn("rcpending@example.com", password);
const { body: profiles } = await request(
  `profiles?select=id,email,full_name,username&id=eq.${account.userId}`,
  account.token
);
const profile = profiles[0];
assert(Boolean(profile?.username), "pending signup fixture has a reusable public profile");

const { body: facilities } = await request(
  "facilities?select=id,slug&slug=eq.rip-city",
  account.token
);
const facility = facilities[0];
assert(Boolean(facility), "Rip City facility is available");

const { body: memberships } = await request(
  `facility_members?select=id,role,status&facility_id=eq.${facility.id}&profile_id=eq.${account.userId}`,
  account.token
);
const membership = memberships[0];
assert(Boolean(membership), "pending signup fixture has one facility membership");

const { body: memberProfiles } = await request(
  `member_profiles?select=id,member_type,sport,position,school,graduation_year,body_weight&facility_member_id=eq.${membership.id}`,
  account.token
);
const memberProfile = memberProfiles[0];
assert(Boolean(memberProfile), "pending signup fixture has one member profile");

const input = {
  p_full_name: profile.full_name,
  p_username: profile.username,
  p_member_type: memberProfile.member_type,
  p_sport: memberProfile.sport,
  p_position: memberProfile.position,
  p_school: memberProfile.school,
  p_graduation_year: memberProfile.graduation_year,
  p_body_weight: memberProfile.body_weight
};

for (const attempt of [1, 2]) {
  const result = await rpc("complete_member_signup", account.token, input);
  assert(
    result.response.ok,
    `retry ${attempt} completes without creating duplicate rows (${result.response.status}: ${JSON.stringify(result.body)})`
  );
  assert(result.body[0]?.facility_member_id === membership.id, `retry ${attempt} preserves the membership row`);
  assert(result.body[0]?.member_profile_id === memberProfile.id, `retry ${attempt} preserves the member profile row`);
}

const { body: membershipCount } = await request(
  `facility_members?select=id&facility_id=eq.${facility.id}&profile_id=eq.${account.userId}`,
  account.token
);
const { body: memberProfileCount } = await request(
  `member_profiles?select=id&facility_member_id=eq.${membership.id}`,
  account.token
);
assert(membershipCount.length === 1, "retries leave exactly one facility membership");
assert(memberProfileCount.length === 1, "retries leave exactly one member profile");

const mismatch = await rpc("complete_member_signup", account.token, {
  ...input,
  p_username: `${profile.username}-wrong`
});
assert(!mismatch.response.ok, "a retry cannot replace the account username");

console.log("Atomic signup completion staging checks passed.");
