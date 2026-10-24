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

const [ripAdmin, ripCoach, ripAthlete, alphaCoach] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("rcathlete@example.com", password),
  signIn("alphacoach@example.com", password)
]);

const { body: facilities } = await request(
  "facilities?select=id,slug&slug=eq.rip-city",
  ripAdmin.token
);
const ripCity = facilities[0];
assert(Boolean(ripCity), "Rip City staging facility is available");

const { body: athleteMemberships } = await request(
  `facility_members?select=id&profile_id=eq.${ripAthlete.userId}&facility_id=eq.${ripCity.id}`,
  ripAdmin.token
);
const athleteMembershipId = athleteMemberships[0]?.id;
const { body: athleteProfiles } = await request(
  `member_profiles?select=id&facility_member_id=eq.${athleteMembershipId}`,
  ripAdmin.token
);
const athleteProfileId = athleteProfiles[0]?.id;
assert(Boolean(athleteProfileId), "Rip City athlete fixture has a member profile");

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let adminGroupId = null;
let coachGroupId = null;

try {
  const adminGroup = await request("groups?select=id,created_by", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({
      facility_id: ripCity.id,
      name: `RLS Admin Group ${suffix}`,
      group_type: "custom",
      member_type: "athlete",
      created_by: ripAdmin.userId
    })
  });
  adminGroupId = adminGroup.body[0]?.id;
  assert(adminGroup.response.ok && Boolean(adminGroupId), "facility admin can create an owned group");

  const coachGroup = await request("groups?select=id,created_by", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      facility_id: ripCity.id,
      name: `RLS Coach Group ${suffix}`,
      group_type: "custom",
      member_type: "athlete",
      created_by: ripCoach.userId
    })
  });
  coachGroupId = coachGroup.body[0]?.id;
  assert(coachGroup.response.ok && Boolean(coachGroupId), "ordinary coach can create an owned group");

  const spoofedOwner = await request("groups?select=id", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      facility_id: ripCity.id,
      name: `RLS Spoofed Group ${suffix}`,
      group_type: "custom",
      member_type: "athlete",
      created_by: ripAdmin.userId
    })
  });
  assert(!spoofedOwner.response.ok, "ordinary coach cannot assign a different group creator");

  const adminGroupMember = await request("group_members?select=id", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({ group_id: adminGroupId, member_profile_id: athleteProfileId })
  });
  const adminGroupMemberId = adminGroupMember.body[0]?.id;
  assert(adminGroupMember.response.ok && Boolean(adminGroupMemberId), "coach can add a member to an admin-created group");

  const coachGroupMember = await request("group_members?select=id", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({ group_id: coachGroupId, member_profile_id: athleteProfileId })
  });
  const coachGroupMemberId = coachGroupMember.body[0]?.id;
  assert(coachGroupMember.response.ok && Boolean(coachGroupMemberId), "coach can add a member to a coach-created group");

  const deniedMemberRemoval = await request(
    `group_members?id=eq.${adminGroupMemberId}&select=id`,
    ripCoach.token,
    { method: "DELETE" }
  );
  assert(
    deniedMemberRemoval.response.ok && deniedMemberRemoval.body.length === 0,
    "ordinary coach cannot remove a member from a group they did not create"
  );

  const preservedMembership = await request(
    `group_members?select=id&id=eq.${adminGroupMemberId}`,
    ripAdmin.token
  );
  assert(preservedMembership.body[0]?.id === adminGroupMemberId, "denied removal preserves the group membership");

  const adminRemoval = await request(
    `group_members?id=eq.${coachGroupMemberId}&select=id`,
    ripAdmin.token,
    { method: "DELETE" }
  );
  assert(adminRemoval.body[0]?.id === coachGroupMemberId, "facility admin can remove a member from a coach-created group");

  const restoredCoachMembership = await request("group_members?select=id", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({ group_id: coachGroupId, member_profile_id: athleteProfileId })
  });
  assert(restoredCoachMembership.response.ok && Boolean(restoredCoachMembership.body[0]?.id), "coach can add the member back to their own group");

  const deniedGroupDelete = await request(
    `groups?id=eq.${adminGroupId}&select=id`,
    ripCoach.token,
    { method: "DELETE" }
  );
  assert(
    deniedGroupDelete.response.ok && deniedGroupDelete.body.length === 0,
    "ordinary coach cannot delete a group they did not create"
  );

  const crossFacilityDelete = await request(
    `groups?id=eq.${adminGroupId}&select=id`,
    alphaCoach.token,
    { method: "DELETE" }
  );
  assert(
    crossFacilityDelete.response.ok && crossFacilityDelete.body.length === 0,
    "coach from another facility cannot delete the group"
  );

  const coachOwnedDelete = await request(
    `groups?id=eq.${coachGroupId}&select=id`,
    ripCoach.token,
    { method: "DELETE" }
  );
  assert(coachOwnedDelete.body[0]?.id === coachGroupId, "ordinary coach can delete their own group");
  coachGroupId = null;

  const adminOwnedDelete = await request(
    `groups?id=eq.${adminGroupId}&select=id`,
    ripAdmin.token,
    { method: "DELETE" }
  );
  assert(adminOwnedDelete.body[0]?.id === adminGroupId, "facility admin can delete an admin-created group");
  adminGroupId = null;
} finally {
  if (coachGroupId) await request(`groups?id=eq.${coachGroupId}`, ripAdmin.token, { method: "DELETE" });
  if (adminGroupId) await request(`groups?id=eq.${adminGroupId}`, ripAdmin.token, { method: "DELETE" });
}

console.log("Group-ownership staging RLS checks passed and fixtures were cleaned up.");
