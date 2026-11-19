import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20261108190000_add_platform_admin_invites.sql", "utf8");
const auth = await readFile("js/auth/auth.js", "utf8");
const platform = await readFile("js/platform/platform.js", "utf8");

assert.match(migration, /create_platform_admin_invite/);
assert.match(migration, /app_private\.is_platform_owner\(\)/);
assert.match(migration, /server_now \+ interval '7 days'/);
assert.match(migration, /claim_platform_admin_invite/);
assert.match(migration, /'admin', 'pending'/);
assert.match(migration, /claimed_at is not null/);
assert.match(auth, /admin_invite/);
assert.match(auth, /claim_platform_admin_invite/);
assert.match(platform, /Copy First Admin Link/);
assert.match(platform, /create_platform_admin_invite/);

console.log("Platform first-admin invite contract checks passed.");
