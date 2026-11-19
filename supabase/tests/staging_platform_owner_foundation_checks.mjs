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

async function rpc(name, token, body = {}) {
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

const [ripCityPlatformOwner, alphaPlatformOwner, facilityAdmin, ordinaryCoach] = await Promise.all([
  signIn("rcplatform@example.com", password),
  signIn("alphaplatform@example.com", password),
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password)
]);

const ripCityOwnerStatus = await rpc("current_user_is_platform_owner", ripCityPlatformOwner.token);
assert(
  ripCityOwnerStatus.response.ok && ripCityOwnerStatus.body === true,
  "Rip City platform fixture has platform-owner authorization"
);

const alphaOwnerStatus = await rpc("current_user_is_platform_owner", alphaPlatformOwner.token);
assert(
  alphaOwnerStatus.response.ok && alphaOwnerStatus.body === true,
  "Alpha platform fixture has platform-owner authorization"
);

const adminStatus = await rpc("current_user_is_platform_owner", facilityAdmin.token);
assert(adminStatus.response.ok && adminStatus.body === false, "facility admin is not automatically a platform owner");

const coachStatus = await rpc("current_user_is_platform_owner", ordinaryCoach.token);
assert(coachStatus.response.ok && coachStatus.body === false, "ordinary coach is not a platform owner");

const ownerFacilities = await rpc("list_platform_facilities", ripCityPlatformOwner.token);
assert(ownerFacilities.response.ok, "platform owner can open the platform facility list");
assert(ownerFacilities.body.length >= 2, "platform facility list includes both staging facilities");

const ripCity = ownerFacilities.body.find((facility) => facility.facility_slug === "rip-city");
const alpha = ownerFacilities.body.find((facility) => facility.facility_slug === "test-facility-alpha");
assert(Boolean(ripCity) && Boolean(alpha), "Rip City and Test Facility Alpha are available to platform operations");

const alphaOwnerFacilities = await rpc("list_platform_facilities", alphaPlatformOwner.token);
assert(
  alphaOwnerFacilities.response.ok && alphaOwnerFacilities.body.length === ownerFacilities.body.length,
  "second platform fixture receives the same platform facility directory"
);

const ripCityAdminMembership = await request(
  `facility_members?select=facility_id,role,status&profile_id=eq.${ripCityPlatformOwner.userId}`,
  ripCityPlatformOwner.token
);
assert(
  ripCityAdminMembership.response.ok
    && ripCityAdminMembership.body.some((membership) => (
      membership.facility_id === ripCity.facility_id
      && membership.role === "admin"
      && membership.status === "approved"
    )),
  "Rip City platform fixture can enter the existing Rip City admin experience"
);

const alphaAdminMembership = await request(
  `facility_members?select=facility_id,role,status&profile_id=eq.${alphaPlatformOwner.userId}`,
  alphaPlatformOwner.token
);
assert(
  alphaAdminMembership.response.ok
    && alphaAdminMembership.body.some((membership) => (
      membership.facility_id === alpha.facility_id
      && membership.role === "admin"
      && membership.status === "approved"
    )),
  "Alpha platform fixture can enter the existing Alpha admin experience"
);

const deniedAdminList = await rpc("list_platform_facilities", facilityAdmin.token);
assert(!deniedAdminList.response.ok, "facility admin cannot invoke platform facility operations");

const deniedCoachList = await rpc("list_platform_facilities", ordinaryCoach.token);
assert(!deniedCoachList.response.ok, "ordinary coach cannot invoke platform facility operations");

const crossFacilityMemberships = await request(
  `facility_members?select=id&facility_id=eq.${alpha.facility_id}`,
  ripCityPlatformOwner.token
);
assert(
  crossFacilityMemberships.response.ok && crossFacilityMemberships.body.length === 0,
  "platform ownership does not bypass private cross-facility membership RLS"
);

const directFacilityInsert = await request("facilities?select=id", ripCityPlatformOwner.token, {
  method: "POST",
  body: JSON.stringify({
    name: `Denied Direct Facility ${Date.now()}`,
    slug: `denied-direct-facility-${Date.now()}`
  })
});
assert(!directFacilityInsert.response.ok, "platform owner cannot bypass the future trusted facility-creation workflow");

const privateOwnerTable = await request("platform_owners?select=profile_id", ripCityPlatformOwner.token);
assert(!privateOwnerTable.response.ok, "platform-owner roster is not exposed through the public REST API");

console.log("Platform-owner foundation staging checks passed.");
