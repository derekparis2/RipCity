import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20261108180000_add_platform_facility_provisioning.sql", "utf8");
const accessControl = await readFile("js/shared/access-control.js", "utf8");
const coachNav = await readFile("js/coach/coach-nav.js", "utf8");
const platformPage = await readFile("platform.html", "utf8");
const platformController = await readFile("js/platform/platform.js", "utf8");

assert.match(migration, /create_platform_facility/, "migration exposes trusted facility creation");
assert.match(migration, /replace_platform_facility_configuration/, "creation reuses configuration validation");
assert.match(migration, /insert into public\.facility_members[\s\S]*'admin'[\s\S]*'approved'/, "creation grants an explicit admin membership");
assert.match(migration, /facility\.created/, "creation records a platform audit event");
assert.match(migration, /enter_platform_facility_admin/, "admin mode is an explicit operation");
assert.match(accessControl, /ripcity:selected-facility-id/, "access control remembers the selected admin facility");
assert.match(accessControl, /getCurrentUserIsPlatformOwner/, "pages resolve platform authorization from the database");
assert.match(coachNav, /href: "platform\.html"/, "navigation exposes platform tools to owners");
assert.match(platformPage, /id="platform-create-form"/, "platform page includes facility creation");
assert.match(platformController, /"create_platform_facility"/, "UI uses trusted facility creation");
assert.match(platformController, /"enter_platform_facility_admin"/, "UI uses audited admin mode");
assert.match(platformController, /RipCityAccess\.selectFacility/, "UI selects the facility before opening admin mode");

console.log("Platform facility provisioning tests passed");
