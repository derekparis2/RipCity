import readline from "node:readline/promises";
import { randomUUID } from "node:crypto";
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

const [ripAdmin, ripCoach, alphaAdmin, alphaCoach, invitee, otherMember] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("alphaadmin@example.com", password),
  signIn("alphacoach@example.com", password),
  signIn("rcpending@example.com", password),
  signIn("rcathlete@example.com", password)
]);

const { body: facilities } = await request(
  "facilities?select=id,name,slug&slug=in.(rip-city,test-facility-alpha)",
  alphaAdmin.token
);
const ripCity = facilities.find(facility => facility.slug === "rip-city");
const alpha = facilities.find(facility => facility.slug === "test-facility-alpha");
assert(ripCity && alpha, "both staging facilities are available");

const deniedCreate = await request("rpc/create_coach_invite", ripCoach.token, {
  method: "POST",
  body: JSON.stringify({ invite_facility_id: ripCity.id })
});
assert(!deniedCreate.response.ok, "ordinary coach cannot create a coach invite");

const overlongInvite = await request("facility_invites?select=id", alphaAdmin.token, {
  method: "POST",
  body: JSON.stringify({
    facility_id: alpha.id,
    created_by: alphaAdmin.userId,
    invite_code: `coach-test-overlong-${randomUUID()}`,
    default_role: "coach",
    active: true,
    expires_at: new Date(Date.now() + (8 * 24 * 60 * 60 * 1000)).toISOString()
  })
});
assert(!overlongInvite.response.ok, "database rejects coach invites lasting longer than seven days");

const directCoachInvite = await request("facility_invites?select=id", alphaAdmin.token, {
  method: "POST",
  body: JSON.stringify({
    facility_id: alpha.id,
    created_by: alphaAdmin.userId,
    invite_code: `coach-test-direct-${randomUUID()}`,
    default_role: "coach",
    active: true,
    expires_at: new Date(Date.now() + 60_000).toISOString()
  })
});
assert(!directCoachInvite.response.ok, "facility admin cannot bypass the coach-invite creation RPC");

let inviteCode;
let inviteId;
let membershipId;

try {
  const createdInvite = await request("rpc/create_coach_invite", alphaAdmin.token, {
    method: "POST",
    body: JSON.stringify({ invite_facility_id: alpha.id })
  });
  if (!createdInvite.response.ok) {
    throw new Error(`admin invite creation failed (${createdInvite.response.status}): ${JSON.stringify(createdInvite.body)}`);
  }
  inviteId = createdInvite.body[0]?.invite_id;
  inviteCode = createdInvite.body[0]?.invite_code;
  const inviteLifetime = new Date(createdInvite.body[0]?.expires_at).getTime()
    - new Date(createdInvite.body[0]?.created_at).getTime();
  assert(Boolean(inviteId && inviteCode), "facility admin can create a coach invite");
  assert(
    inviteLifetime === 7 * 24 * 60 * 60 * 1000,
    "database generates the coach invite expiration from server time"
  );

  const directTimestampUpdate = await request(`facility_invites?id=eq.${inviteId}`, alphaAdmin.token, {
    method: "PATCH",
    body: JSON.stringify({
      created_at: new Date(Date.now() + (29 * 24 * 60 * 60 * 1000)).toISOString(),
      expires_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
    })
  });
  assert(
    !directTimestampUpdate.response.ok || directTimestampUpdate.body.length === 0,
    "facility admin cannot directly change coach-invite timestamps"
  );

  const lookup = await request("rpc/lookup_coach_invite", undefined, {
    method: "POST",
    body: JSON.stringify({ lookup_invite_code: inviteCode })
  });
  assert(
    lookup.response.ok && lookup.body[0]?.facility_name === "Test Facility Alpha",
    "anonymous signup page can validate the invite without reading invite data"
  );

  const claim = await request("rpc/claim_coach_invite", invitee.token, {
    method: "POST",
    body: JSON.stringify({ claim_invite_code: inviteCode })
  });
  if (!claim.response.ok) {
    throw new Error(`coach invite claim failed (${claim.response.status}): ${JSON.stringify(claim.body)}`);
  }
  membershipId = claim.body[0]?.membership_id;
  assert(Boolean(membershipId), "authenticated invitee can claim a valid coach invite once");

  const claimedLookup = await request("rpc/lookup_coach_invite", undefined, {
    method: "POST",
    body: JSON.stringify({ lookup_invite_code: inviteCode })
  });
  assert(claimedLookup.response.ok && claimedLookup.body.length === 0, "claimed link is no longer valid on the signup page");

  const claimedMembership = await request(
    `facility_members?select=id,facility_id,profile_id,role,status&id=eq.${membershipId}`,
    invitee.token
  );
  assert(
    claimedMembership.body[0]?.facility_id === alpha.id
      && claimedMembership.body[0]?.role === "coach"
      && claimedMembership.body[0]?.status === "pending",
    "claim creates only a pending coach membership in the invited facility"
  );

  const secondClaim = await request("rpc/claim_coach_invite", otherMember.token, {
    method: "POST",
    body: JSON.stringify({ claim_invite_code: inviteCode })
  });
  assert(!secondClaim.response.ok, "coach invite cannot be claimed a second time");

  const reopenClaimedInvite = await request(`facility_invites?id=eq.${inviteId}`, alphaAdmin.token, {
    method: "PATCH",
    body: JSON.stringify({ active: true, claimed_by: null, claimed_at: null })
  });
  assert(
    !reopenClaimedInvite.response.ok || reopenClaimedInvite.body.length === 0,
    "claimed coach invite cannot be reopened by an admin"
  );

  const coachApproval = await request(`facility_members?id=eq.${membershipId}`, alphaCoach.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" })
  });
  assert(coachApproval.response.ok && coachApproval.body.length === 0, "ordinary coach cannot approve a coach");

  const crossFacilityApproval = await request(`facility_members?id=eq.${membershipId}`, ripAdmin.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" })
  });
  assert(
    crossFacilityApproval.response.ok && crossFacilityApproval.body.length === 0,
    "admin from another facility cannot approve the coach"
  );

  const adminApproval = await request(`facility_members?id=eq.${membershipId}`, alphaAdmin.token, {
    method: "PATCH",
    body: JSON.stringify({
      status: "approved",
      approved_by: alphaAdmin.userId,
      approved_at: new Date().toISOString()
    })
  });
  assert(
    adminApproval.response.ok && adminApproval.body[0]?.status === "approved",
    "invited facility admin can approve the pending coach"
  );
} finally {
  if (membershipId) {
    await request(`facility_members?id=eq.${membershipId}`, alphaAdmin.token, { method: "DELETE" });
  }
  if (inviteId) {
    await request(`facility_invites?id=eq.${inviteId}`, alphaAdmin.token, { method: "DELETE" });
  }
}

console.log("Coach-invite staging RLS checks passed.");
