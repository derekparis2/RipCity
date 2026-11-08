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

function replacePayload(facilityId, config, overrides = {}) {
  return {
    p_facility_id: facilityId,
    p_name: overrides.name ?? config.name,
    p_logo_url: overrides.logoUrl ?? config.logo_url,
    p_primary_color: overrides.primaryColor ?? config.primary_color,
    p_secondary_color: overrides.secondaryColor ?? config.secondary_color,
    p_time_zone: overrides.timeZone ?? config.time_zone,
    p_terminology: overrides.terminology ?? config.terminology,
    p_modules: overrides.modules ?? config.modules,
    p_programs: overrides.programs ?? config.programs
  };
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [platformOwner, facilityAdmin, ordinaryCoach, alphaAthlete, ripCityAthlete] = await Promise.all([
  signIn("rcplatform@example.com", password),
  signIn("alphaadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("alphaathlete@example.com", password),
  signIn("rcathlete@example.com", password)
]);

const facilitiesResult = await rpc("list_platform_facilities", platformOwner.token);
assert(facilitiesResult.response.ok, "platform owner can load facilities for configuration");

const ripCity = facilitiesResult.body.find((facility) => facility.facility_slug === "rip-city");
const alpha = facilitiesResult.body.find((facility) => facility.facility_slug === "test-facility-alpha");
assert(Boolean(ripCity) && Boolean(alpha), "both staging facilities are available for configuration checks");

const alphaOriginalResult = await rpc("get_facility_configuration", platformOwner.token, {
  p_facility_id: alpha.facility_id
});
assert(alphaOriginalResult.response.ok, "platform owner can read a facility configuration");
const alphaOriginal = alphaOriginalResult.body;

assert(alphaOriginal.time_zone === "America/New_York", "existing facility receives the default IANA time zone");
assert(alphaOriginal.status === "active", "existing facility remains active after configuration migration");
assert(alphaOriginal.modules.length === 6, "existing facility receives every shipped module configuration");
assert(alphaOriginal.modules.every((module) => module.enabled), "existing facility modules remain enabled by default");
assert(alphaOriginal.programs.length === 2, "existing facility receives both supported member-program records");

const coachOwnConfig = await rpc("get_facility_configuration", ordinaryCoach.token, {
  p_facility_id: ripCity.facility_id
});
assert(coachOwnConfig.response.ok, "approved staff can read their own facility configuration");

const alphaMemberOwnConfig = await rpc("get_facility_configuration", alphaAthlete.token, {
  p_facility_id: alpha.facility_id
});
assert(alphaMemberOwnConfig.response.ok, "approved member can read their own facility configuration");

const deniedCrossFacilityRead = await rpc("get_facility_configuration", ripCityAthlete.token, {
  p_facility_id: alpha.facility_id
});
assert(!deniedCrossFacilityRead.response.ok, "member cannot read another facility configuration");

const deniedAdminReplace = await rpc("replace_platform_facility_configuration", facilityAdmin.token, {
  ...replacePayload(alpha.facility_id, alphaOriginal),
  p_time_zone: "America/Chicago"
});
assert(!deniedAdminReplace.response.ok, "facility admin cannot invoke platform configuration replacement");

const deniedDirectAdminUpdate = await request(
  `facilities?id=eq.${alpha.facility_id}`,
  facilityAdmin.token,
  {
    method: "PATCH",
    body: JSON.stringify({ time_zone: "America/Chicago" })
  }
);
assert(
  deniedDirectAdminUpdate.response.ok && deniedDirectAdminUpdate.body.length === 0,
  "facility admin cannot directly update platform-controlled facility fields"
);

const invalidTimeZone = await rpc("replace_platform_facility_configuration", platformOwner.token, {
  ...replacePayload(alpha.facility_id, alphaOriginal),
  p_time_zone: "Not/A_Time_Zone"
});
assert(!invalidTimeZone.response.ok, "database rejects an invalid facility time zone");

const configuredModules = alphaOriginal.modules.map((module) => ({
  ...module,
  enabled: module.module_key === "habits" ? false : module.enabled
}));
const configuredPrograms = alphaOriginal.programs.map((program) => ({
  ...program,
  enabled: program.program_key === "h2k" ? false : program.enabled
}));
const configuredTerminology = {
  ...alphaOriginal.terminology,
  member_singular: "Player",
  member_plural: "Players"
};

let configurationChanged = false;
try {
  const replaceResult = await rpc("replace_platform_facility_configuration", platformOwner.token, {
    ...replacePayload(alpha.facility_id, alphaOriginal),
    p_primary_color: "#123456",
    p_secondary_color: "#ABCDEF",
    p_time_zone: "America/Chicago",
    p_terminology: configuredTerminology,
    p_modules: configuredModules,
    p_programs: configuredPrograms
  });
  assert(replaceResult.response.ok, "platform owner can transactionally replace facility configuration");
  configurationChanged = true;

  const configured = replaceResult.body;
  assert(configured.time_zone === "America/Chicago", "facility configuration stores its authoritative time zone");
  assert(configured.primary_color === "#123456", "facility configuration stores validated branding colors");
  assert(configured.terminology.member_plural === "Players", "facility configuration stores custom terminology");
  assert(
    configured.modules.find((module) => module.module_key === "habits")?.enabled === false,
    "facility configuration can disable a module"
  );
  assert(
    configured.programs.find((program) => program.program_key === "h2k")?.enabled === false,
    "facility configuration can disable a member program"
  );

  const alphaMemberConfigured = await rpc("get_facility_configuration", alphaAthlete.token, {
    p_facility_id: alpha.facility_id
  });
  assert(
    alphaMemberConfigured.response.ok
      && alphaMemberConfigured.body.time_zone === "America/Chicago"
      && alphaMemberConfigured.body.modules.find((module) => module.module_key === "habits")?.enabled === false,
    "own-facility member reads the updated configuration without private cross-facility access"
  );
} finally {
  if (configurationChanged) {
    const restoreResult = await rpc(
      "replace_platform_facility_configuration",
      platformOwner.token,
      replacePayload(alpha.facility_id, alphaOriginal)
    );
    assert(restoreResult.response.ok, "staging facility configuration is restored after the test");
  }
}

console.log("Facility-configuration staging checks passed.");
