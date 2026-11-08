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

const [platformOwner, alphaAdmin, ripCoach, invitee, secondMember] = await Promise.all([
  signIn("rcplatform@example.com", password),
  signIn("alphaadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("rcpending@example.com", password),
  signIn("rcathlete@example.com", password)
]);

const directory = await rpc("list_platform_facilities", platformOwner.token);
const rehearsal = directory.body.find((facility) => facility.facility_slug === "platform-launch-rehearsal");
assert(Boolean(rehearsal), "launch-rehearsal facility is available");

const deniedCreate = await rpc("create_platform_admin_invite", alphaAdmin.token, {
  p_facility_id: rehearsal.facility_id
});
assert(!deniedCreate.response.ok, "facility admin cannot create a platform first-admin invite");

let inviteId;
let inviteCode;
let membershipId;

try {
  const created = await rpc("create_platform_admin_invite", platformOwner.token, {
    p_facility_id: rehearsal.facility_id
  });
  if (!created.response.ok) throw new Error(`invite creation failed: ${JSON.stringify(created.body)}`);
  inviteId = created.body[0]?.invite_id;
  inviteCode = created.body[0]?.invite_code;
  const lifetime = new Date(created.body[0]?.expires_at).getTime()
    - new Date(created.body[0]?.created_at).getTime();
  assert(Boolean(inviteId && inviteCode), "platform owner can create a first-admin invite");
  assert(lifetime === 7 * 24 * 60 * 60 * 1000, "first-admin invite expires after seven days");

  const lookup = await rpc("lookup_platform_admin_invite_configuration", undefined, {
    lookup_invite_code: inviteCode
  });
  assert(
    lookup.response.ok && lookup.body?.facility_slug === "platform-launch-rehearsal",
    "anonymous signup can read only safe facility branding for a valid invite"
  );

  const claim = await rpc("claim_platform_admin_invite", invitee.token, {
    claim_invite_code: inviteCode
  });
  if (!claim.response.ok) throw new Error(`invite claim failed: ${JSON.stringify(claim.body)}`);
  membershipId = claim.body[0]?.membership_id;
  assert(Boolean(membershipId), "authenticated invitee can claim the first-admin invite once");

  const membership = await request(
    `facility_members?select=id,facility_id,role,status&id=eq.${membershipId}`,
    invitee.token
  );
  assert(
    membership.body[0]?.facility_id === rehearsal.facility_id
      && membership.body[0]?.role === "admin"
      && membership.body[0]?.status === "pending",
    "claim creates only pending admin access in the invited facility"
  );

  const secondClaim = await rpc("claim_platform_admin_invite", secondMember.token, {
    claim_invite_code: inviteCode
  });
  assert(!secondClaim.response.ok, "first-admin invite cannot be claimed twice");

  const coachApproval = await request(`facility_members?id=eq.${membershipId}`, ripCoach.token, {
    method: "PATCH", body: JSON.stringify({ status: "approved" })
  });
  assert(coachApproval.response.ok && coachApproval.body.length === 0, "ordinary coach cannot approve the admin");

  const crossFacilityApproval = await request(`facility_members?id=eq.${membershipId}`, alphaAdmin.token, {
    method: "PATCH", body: JSON.stringify({ status: "approved" })
  });
  assert(
    crossFacilityApproval.response.ok && crossFacilityApproval.body.length === 0,
    "another facility admin cannot approve the admin"
  );

  const ownerApproval = await request(`facility_members?id=eq.${membershipId}`, platformOwner.token, {
    method: "PATCH",
    body: JSON.stringify({
      status: "approved", approved_by: platformOwner.userId, approved_at: new Date().toISOString()
    })
  });
  assert(
    ownerApproval.response.ok && ownerApproval.body[0]?.status === "approved",
    "platform owner in explicit facility admin mode can approve the first admin"
  );
} finally {
  if (membershipId) {
    await request(`facility_members?id=eq.${membershipId}`, platformOwner.token, { method: "DELETE" });
  }
  if (inviteId) {
    await request(`facility_invites?id=eq.${inviteId}`, platformOwner.token, { method: "DELETE" });
  }
}

console.log("Platform first-admin invite staging checks passed and fixtures were cleaned up.");
