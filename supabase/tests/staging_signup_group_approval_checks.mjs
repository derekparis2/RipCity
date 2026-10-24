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

const [ripAdmin, ripCoach, pendingAthlete, ripH2k, alphaAdmin] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("rcpending@example.com", password),
  signIn("rch2k@example.com", password),
  signIn("alphaadmin@example.com", password)
]);

const { body: ripFacilities } = await request(
  "facilities?select=id,slug&slug=eq.rip-city",
  ripAdmin.token
);
const { body: alphaFacilities } = await request(
  "facilities?select=id,slug&slug=eq.test-facility-alpha",
  alphaAdmin.token
);
const ripCity = ripFacilities[0];
const alpha = alphaFacilities[0];
assert(Boolean(ripCity && alpha), "both staging facilities are available");

const { body: pendingMemberships } = await request(
  `facility_members?select=id,role,status,approved_by,approved_at&profile_id=eq.${pendingAthlete.userId}&facility_id=eq.${ripCity.id}`,
  ripAdmin.token
);
const pendingMembership = pendingMemberships[0];
assert(
  pendingMembership?.role === "athlete" && pendingMembership?.status === "pending",
  "pending athlete fixture is ready for approval testing"
);

const { body: memberProfiles } = await request(
  `member_profiles?select=id&facility_member_id=eq.${pendingMembership.id}`,
  ripAdmin.token
);
const memberProfileId = memberProfiles[0]?.id;
assert(Boolean(memberProfileId), "pending athlete has a member profile");

const { body: originalMemberships } = await request(
  `group_members?select=id,group_id,member_profile_id,created_at&member_profile_id=eq.${memberProfileId}`,
  ripAdmin.token
);
const { body: alphaGroups } = await request(
  `groups?select=id&facility_id=eq.${alpha.id}&member_type=in.(athlete,both)&limit=1`,
  alphaAdmin.token
);
const alphaGroupId = alphaGroups[0]?.id;
assert(Boolean(alphaGroupId), "another-facility athlete group is available");

const { body: h2kMemberships } = await request(
  `facility_members?select=id,role,status,approved_by,approved_at&profile_id=eq.${ripH2k.userId}&facility_id=eq.${ripCity.id}`,
  ripAdmin.token
);
const h2kMembership = h2kMemberships[0];
assert(
  h2kMembership?.role === "h2k_member" && h2kMembership?.status === "approved",
  "approved H2K fixture is ready for approval testing"
);

const { body: h2kProfiles } = await request(
  `member_profiles?select=id&facility_member_id=eq.${h2kMembership.id}`,
  ripAdmin.token
);
const h2kProfileId = h2kProfiles[0]?.id;
assert(Boolean(h2kProfileId), "H2K fixture has a member profile");

const { body: originalH2kMemberships } = await request(
  `group_members?select=id,group_id,member_profile_id,created_at&member_profile_id=eq.${h2kProfileId}`,
  ripAdmin.token
);
assert(originalH2kMemberships.length > 0, "H2K fixture group memberships can be restored after testing");

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let testGroupId = null;
let h2kTestGroupId = null;

try {
  const createdGroup = await request("groups?select=id", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({
      facility_id: ripCity.id,
      name: `Signup Approval QA ${suffix}`,
      group_type: "custom",
      member_type: "athlete",
      created_by: ripAdmin.userId
    })
  });
  testGroupId = createdGroup.body[0]?.id;
  assert(createdGroup.response.ok && Boolean(testGroupId), "facility admin can create the temporary athlete group");

  const selfAssignment = await request("group_members?select=id", pendingAthlete.token, {
    method: "POST",
    body: JSON.stringify({ group_id: testGroupId, member_profile_id: memberProfileId })
  });
  assert(!selfAssignment.response.ok, "pending athlete cannot assign their own signup group");

  const removedOriginals = await request(
    `group_members?member_profile_id=eq.${memberProfileId}&select=id`,
    ripAdmin.token,
    { method: "DELETE" }
  );
  assert(removedOriginals.response.ok, "fixture group memberships can be isolated for the approval checks");

  const directApproval = await request(
    `facility_members?id=eq.${pendingMembership.id}&select=id,status`,
    ripAdmin.token,
    { method: "PATCH", body: JSON.stringify({ status: "approved" }) }
  );
  assert(!directApproval.response.ok, "database rejects athlete approval without a training group");

  const coachApproval = await rpc("approve_pending_member", ripCoach.token, {
    pending_facility_member_id: pendingMembership.id,
    initial_group_id: testGroupId
  });
  assert(!coachApproval.response.ok, "ordinary coach cannot approve and assign a pending athlete");

  const crossFacilityApproval = await rpc("approve_pending_member", ripAdmin.token, {
    pending_facility_member_id: pendingMembership.id,
    initial_group_id: alphaGroupId
  });
  assert(!crossFacilityApproval.response.ok, "facility admin cannot assign an athlete to another facility's group");

  const adminApproval = await rpc("approve_pending_member", ripAdmin.token, {
    pending_facility_member_id: pendingMembership.id,
    initial_group_id: testGroupId
  });
  assert(
    adminApproval.response.ok && adminApproval.body[0]?.status === "approved",
    `facility admin atomically assigns the initial group and approves the athlete (${adminApproval.response.status}: ${JSON.stringify(adminApproval.body)})`
  );

  const { body: approvedMemberships } = await request(
    `facility_members?select=status,approved_by&profile_id=eq.${pendingAthlete.userId}&facility_id=eq.${ripCity.id}`,
    ripAdmin.token
  );
  const { body: assignedGroups } = await request(
    `group_members?select=group_id&member_profile_id=eq.${memberProfileId}&group_id=eq.${testGroupId}`,
    ripAdmin.token
  );
  assert(
    approvedMemberships[0]?.status === "approved" && assignedGroups[0]?.group_id === testGroupId,
    "approved athlete and selected group are both persisted"
  );

  const createdH2kGroup = await request("groups?select=id", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({
      facility_id: ripCity.id,
      name: `H2K Signup Approval QA ${suffix}`,
      group_type: "h2k",
      member_type: "h2k",
      created_by: ripAdmin.userId
    })
  });
  h2kTestGroupId = createdH2kGroup.body[0]?.id;
  assert(createdH2kGroup.response.ok && Boolean(h2kTestGroupId), "facility admin can create the temporary H2K group");

  const pendingH2k = await request(
    `facility_members?id=eq.${h2kMembership.id}&select=id,status`,
    ripAdmin.token,
    { method: "PATCH", body: JSON.stringify({ status: "pending", approved_by: null, approved_at: null }) }
  );
  assert(pendingH2k.body[0]?.status === "pending", "H2K fixture can be placed into pending state for the approval check");

  await request(
    `group_members?member_profile_id=eq.${h2kProfileId}`,
    ripAdmin.token,
    { method: "DELETE" }
  );

  const wrongTypeApproval = await rpc("approve_pending_member", ripAdmin.token, {
    pending_facility_member_id: h2kMembership.id,
    initial_group_id: testGroupId
  });
  assert(!wrongTypeApproval.response.ok, "facility admin cannot assign an H2K member to an athlete-only group");

  const h2kApproval = await rpc("approve_pending_member", ripAdmin.token, {
    pending_facility_member_id: h2kMembership.id,
    initial_group_id: h2kTestGroupId
  });
  assert(
    h2kApproval.response.ok && h2kApproval.body[0]?.status === "approved",
    `facility admin atomically assigns the initial group and approves the H2K member (${h2kApproval.response.status}: ${JSON.stringify(h2kApproval.body)})`
  );
} finally {
  if (pendingMembership?.id) {
    await request(
      `facility_members?id=eq.${pendingMembership.id}`,
      ripAdmin.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: pendingMembership.status,
          approved_by: pendingMembership.approved_by,
          approved_at: pendingMembership.approved_at
        })
      }
    );
  }

  if (memberProfileId) {
    await request(
      `group_members?member_profile_id=eq.${memberProfileId}`,
      ripAdmin.token,
      { method: "DELETE" }
    );

    if (originalMemberships.length) {
      await request("group_members", ripAdmin.token, {
        method: "POST",
        body: JSON.stringify(originalMemberships)
      });
    }
  }

  if (h2kProfileId) {
    await request(
      `group_members?member_profile_id=eq.${h2kProfileId}`,
      ripAdmin.token,
      { method: "DELETE" }
    );

    if (originalH2kMemberships.length) {
      await request("group_members", ripAdmin.token, {
        method: "POST",
        body: JSON.stringify(originalH2kMemberships)
      });
    }
  }

  if (h2kMembership?.id) {
    await request(
      `facility_members?id=eq.${h2kMembership.id}`,
      ripAdmin.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: h2kMembership.status,
          approved_by: h2kMembership.approved_by,
          approved_at: h2kMembership.approved_at
        })
      }
    );
  }

  if (testGroupId) {
    await request(`groups?id=eq.${testGroupId}`, ripAdmin.token, { method: "DELETE" });
  }

  if (h2kTestGroupId) {
    await request(`groups?id=eq.${h2kTestGroupId}`, ripAdmin.token, { method: "DELETE" });
  }
}

console.log("Admin-assigned athlete/H2K signup group staging checks passed and fixture state was restored.");
