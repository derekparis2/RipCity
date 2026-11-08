import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const accessControl = await readFile("js/shared/access-control.js", "utf8");
const coachNav = await readFile("js/coach/coach-nav.js", "utf8");
const memberNav = await readFile("js/member/member-nav.js", "utf8");
const roster = await readFile("js/coach/coach-roster.js", "utf8");
const auth = await readFile("js/auth/auth.js", "utf8");
const signup = await readFile("signup.html", "utf8");
const migration = await readFile(
  "supabase/migrations/20261108170000_add_facility_aware_signup.sql",
  "utf8"
);

assert.match(
  accessControl,
  /db\.rpc\("get_facility_configuration"/,
  "protected pages load the signed-in facility configuration"
);
assert.match(
  accessControl,
  /MODULE_REQUIREMENTS_BY_PAGE[\s\S]*coach-testing\.html[\s\S]*testing_days/,
  "facility modules gate their protected feature pages"
);
assert.match(
  accessControl,
  /ripcity:facility-config/,
  "facility configuration is published for shared UI components"
);
assert.match(
  accessControl,
  /Intl\.DateTimeFormat\("en-US"[\s\S]*timeZone: getFacilityTimeZone/,
  "facility calendar dates use the configured IANA time zone"
);
assert.match(
  accessControl,
  /\[data-facility-program\]/,
  "shared feature visibility hides disabled member programs"
);
assert.match(
  coachNav,
  /configuration\?\.modules\?\.\[item\.module\]\?\.enabled !== false/,
  "coach navigation hides disabled modules"
);
assert.match(
  memberNav,
  /item\.modules\.some\(moduleKey => configuration\?\.modules\?\.\[moduleKey\]\?\.enabled !== false\)/,
  "member navigation hides disabled modules"
);
assert.match(
  roster,
  /searchParams\.set\("facility", facilitySlug\)/,
  "copied member signup links preserve the facility slug"
);
assert.match(
  roster,
  /option\[data-program-option\]/,
  "roster program choices use facility program configuration"
);
assert.match(signup, /data-signup-program="athlete"/, "signup exposes a configurable athlete program card");
assert.match(signup, /data-signup-program="h2k"/, "signup exposes a configurable H2K program card");
assert.match(auth, /db\.rpc\("lookup_signup_facility"/, "signup loads safe public facility branding and programs");
assert.match(auth, /p_facility_slug: signupFacility\.facility_slug/, "signup completion targets the selected facility");
assert.match(auth, /lookup_coach_invite_configuration/, "coach invites load their destination facility branding");
assert.match(
  auth,
  /getFacilityPendingUrl\(signupFacility\.facility_slug\)/,
  "member signup preserves its facility while waiting for approval"
);
assert.match(
  auth,
  /loadAuthPageFacilityBranding/,
  "pending, legal-consent, and password pages restore signed-in facility branding"
);
assert.match(
  migration,
  /where f\.slug = normalized_facility_slug[\s\S]*f\.status = 'active'/,
  "database signup rejects inactive facilities"
);
assert.match(
  migration,
  /facility_programs[\s\S]*enabled = true/,
  "database signup rejects disabled member programs"
);
assert.match(
  migration,
  /fm\.facility_id <> target_facility_id/,
  "ordinary signup cannot attach an existing account to another facility"
);

console.log("Facility-aware frontend tests passed");
