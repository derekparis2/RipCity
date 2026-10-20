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

async function updateMembership(token, membershipId, status) {
  return request(`facility_members?id=eq.${membershipId}&select=id,status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [ripAdmin, ripCoach, alphaAdmin, alphaCoach, alphaAthlete, pendingMember, inactiveMember] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("alphaadmin@example.com", password),
  signIn("alphacoach@example.com", password),
  signIn("alphaathlete@example.com", password),
  signIn("rcpending@example.com", password),
  signIn("rcinactive@example.com", password)
]);

const { body: facilities } = await request(
  "facilities?select=id,slug&slug=in.(rip-city,test-facility-alpha)",
  alphaAdmin.token
);
const ripCity = facilities.find(facility => facility.slug === "rip-city");
const alpha = facilities.find(facility => facility.slug === "test-facility-alpha");
assert(Boolean(ripCity && alpha), "both staging facilities are available");

const { body: pendingRows } = await request(
  `facility_members?select=id,status&profile_id=eq.${pendingMember.userId}&facility_id=eq.${ripCity.id}`,
  pendingMember.token
);
const pendingMembership = pendingRows[0];
assert(pendingMembership?.status === "pending", "pending member sees the pending membership state");

const pendingHabits = await request("habits?select=id", pendingMember.token);
assert(pendingHabits.response.ok && pendingHabits.body.length === 0, "pending member cannot read protected facility habits");

const { body: inactiveRows } = await request(
  `facility_members?select=id,status&profile_id=eq.${inactiveMember.userId}&facility_id=eq.${ripCity.id}`,
  inactiveMember.token
);
const inactiveMembership = inactiveRows[0];
assert(inactiveMembership?.status === "inactive", "inactive member sees the inactive membership state");

const { body: memberProfileRows } = await request(
  `member_profiles?select=id,facility_member_id&facility_member_id=eq.${inactiveMembership.id}`,
  ripAdmin.token
);
const memberProfile = memberProfileRows[0];
const { body: groupRowsBefore } = await request(
  `group_members?select=id,member_profile_id&member_profile_id=eq.${memberProfile.id}`,
  ripAdmin.token
);
const groupIdsBefore = groupRowsBefore.map(row => row.id).sort();

let pendingOriginalStatus = pendingMembership.status;
let inactiveOriginalStatus = inactiveMembership.status;
let alphaCoachMembershipId;
let alphaCoachOriginalStatus = "approved";

try {
  const ordinaryCoachApproval = await updateMembership(
    ripCoach.token,
    pendingMembership.id,
    "approved"
  );
  assert(
    ordinaryCoachApproval.response.ok && ordinaryCoachApproval.body.length === 0,
    "ordinary coach cannot approve a pending ordinary member"
  );

  const unchangedPendingMember = await request(
    `facility_members?select=id,status&id=eq.${pendingMembership.id}`,
    ripAdmin.token
  );
  assert(
    unchangedPendingMember.body[0]?.status === "pending",
    "denied coach approval leaves the member pending"
  );

  const rejected = await updateMembership(ripAdmin.token, pendingMembership.id, "rejected");
  assert(rejected.response.ok && rejected.body[0]?.status === "rejected", "facility admin can reject a pending member");

  const rejectedOwnRow = await request(
    `facility_members?select=id,status&id=eq.${pendingMembership.id}`,
    pendingMember.token
  );
  assert(rejectedOwnRow.body[0]?.status === "rejected", "rejected member sees the rejected membership state");
  const rejectedHabits = await request("habits?select=id", pendingMember.token);
  assert(rejectedHabits.response.ok && rejectedHabits.body.length === 0, "rejected member remains blocked from protected facility data");

  const reactivatedMember = await updateMembership(ripAdmin.token, inactiveMembership.id, "approved");
  assert(
    reactivatedMember.response.ok
      && reactivatedMember.body[0]?.id === inactiveMembership.id
      && reactivatedMember.body[0]?.status === "approved",
    "member reactivation updates the existing membership row"
  );

  const restoredHabits = await request("habits?select=id", inactiveMember.token);
  assert(restoredHabits.response.ok && restoredHabits.body.length > 0, "reactivated member regains protected facility access");

  const restoredProfile = await request(
    `member_profiles?select=id,facility_member_id&facility_member_id=eq.${inactiveMembership.id}`,
    inactiveMember.token
  );
  assert(
    restoredProfile.body[0]?.id === memberProfile.id,
    "member reactivation preserves the existing member profile relationship"
  );

  const restoredGroups = await request(
    `group_members?select=id,member_profile_id&member_profile_id=eq.${memberProfile.id}`,
    inactiveMember.token
  );
  const restoredGroupIds = restoredGroups.body.map(row => row.id).sort();
  assert(
    JSON.stringify(restoredGroupIds) === JSON.stringify(groupIdsBefore),
    "member reactivation restores the existing group relationships"
  );

  const { body: alphaCoachRows } = await request(
    `facility_members?select=id,status,role&profile_id=eq.${alphaCoach.userId}&facility_id=eq.${alpha.id}`,
    alphaAdmin.token
  );
  const alphaCoachMembership = alphaCoachRows[0];
  alphaCoachMembershipId = alphaCoachMembership?.id;
  alphaCoachOriginalStatus = alphaCoachMembership?.status || "approved";
  assert(
    alphaCoachMembership?.role === "coach" && alphaCoachMembership?.status === "approved",
    "Alpha coach starts with approved coach access"
  );

  const { body: alphaAthleteRows } = await request(
    `facility_members?select=id,status,role&profile_id=eq.${alphaAthlete.userId}&facility_id=eq.${alpha.id}`,
    alphaAdmin.token
  );
  const alphaAthleteMembership = alphaAthleteRows[0];
  assert(
    alphaAthleteMembership?.role === "athlete" && alphaAthleteMembership?.status === "approved",
    "Alpha athlete starts with approved member access"
  );

  const ordinaryCoachMemberUpdate = await updateMembership(
    alphaCoach.token,
    alphaAthleteMembership.id,
    "inactive"
  );
  assert(
    ordinaryCoachMemberUpdate.response.ok && ordinaryCoachMemberUpdate.body.length === 0,
    "ordinary coach cannot deactivate an ordinary member"
  );

  const unchangedAlphaAthlete = await request(
    `facility_members?select=id,status&id=eq.${alphaAthleteMembership.id}`,
    alphaAdmin.token
  );
  assert(
    unchangedAlphaAthlete.body[0]?.status === "approved",
    "denied coach update leaves the member approved"
  );

  const { body: alphaAdminRows } = await request(
    `facility_members?select=id&profile_id=eq.${alphaAdmin.userId}&facility_id=eq.${alpha.id}`,
    alphaAdmin.token
  );
  assert(Boolean(alphaAdminRows[0]?.id), "Alpha facility admin fixture is available for denied-update testing");
  const ordinaryCoachUpdate = await updateMembership(
    alphaCoach.token,
    alphaAdminRows[0]?.id,
    "inactive"
  );
  assert(
    ordinaryCoachUpdate.response.ok && ordinaryCoachUpdate.body.length === 0,
    "ordinary coach cannot deactivate the facility admin"
  );

  const coachRowsBefore = await request(
    `facility_members?select=id&facility_id=eq.${alpha.id}`,
    alphaCoach.token
  );
  assert(coachRowsBefore.body.length > 1, "approved coach can read own-facility membership rows");

  const deactivatedCoach = await updateMembership(alphaAdmin.token, alphaCoachMembershipId, "inactive");
  assert(
    deactivatedCoach.response.ok
      && deactivatedCoach.body[0]?.id === alphaCoachMembershipId
      && deactivatedCoach.body[0]?.status === "inactive",
    "facility admin can deactivate a coach without replacing the membership"
  );

  const blockedCoachRows = await request(
    `facility_members?select=id&facility_id=eq.${alpha.id}`,
    alphaCoach.token
  );
  assert(
    blockedCoachRows.response.ok
      && blockedCoachRows.body.length === 1
      && blockedCoachRows.body[0]?.id === alphaCoachMembershipId,
    "inactive coach loses facility-wide coaching access but can still see the own membership state"
  );

  const selfReactivation = await updateMembership(alphaCoach.token, alphaCoachMembershipId, "approved");
  assert(
    selfReactivation.response.ok && selfReactivation.body.length === 0,
    "inactive coach cannot reactivate the coach membership"
  );

  const reactivatedCoach = await updateMembership(alphaAdmin.token, alphaCoachMembershipId, "approved");
  assert(
    reactivatedCoach.response.ok
      && reactivatedCoach.body[0]?.id === alphaCoachMembershipId
      && reactivatedCoach.body[0]?.status === "approved",
    "facility admin can reactivate the same coach membership"
  );

  const coachRowsAfter = await request(
    `facility_members?select=id&facility_id=eq.${alpha.id}`,
    alphaCoach.token
  );
  assert(
    coachRowsAfter.body.length === coachRowsBefore.body.length,
    "reactivated coach regains the prior facility access scope"
  );
} finally {
  await updateMembership(ripAdmin.token, pendingMembership.id, pendingOriginalStatus);
  await updateMembership(ripAdmin.token, inactiveMembership.id, inactiveOriginalStatus);
  if (alphaCoachMembershipId) {
    await updateMembership(alphaAdmin.token, alphaCoachMembershipId, alphaCoachOriginalStatus);
  }
}

console.log("Account-lifecycle staging RLS checks passed and fixture statuses were restored.");
