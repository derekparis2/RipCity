import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261024150000_add_member_habit_leaderboards.sql", "utf8");
const page = fs.readFileSync("member-leaderboards.html", "utf8");
const controller = fs.readFileSync("js/member/member-leaderboards.js", "utf8");
const nav = fs.readFileSync("js/member/member-nav.js", "utf8");
const habits = fs.readFileSync("member-habits.html", "utf8");
const dashboard = fs.readFileSync("member-dashboard.html", "utf8");

assert.match(migration, /security definer/i, "member ranking is calculated server-side without weakening table RLS");
assert.match(migration, /fm\.profile_id = auth\.uid\(\)/, "RPC derives the member identity from the authenticated user");
assert.match(migration, /mp\.member_type = requester_member_type/, "RPC never mixes Athlete and H2K rankings");
assert.match(migration, /own_group\.member_profile_id = requester_member_profile_id/, "group boards are limited to the caller's own groups");
assert.match(migration, /selected_rank <= 5/, "RPC returns only top-five positions");
assert.match(migration, /r\.id = requester_member_profile_id/, "RPC also returns the caller's own position");
assert.match(migration, /revoke all on function public\.get_member_habit_leaderboard/, "RPC does not remain public");
assert.match(migration, /grant execute .* to authenticated/i, "approved signed-in members may call the RPC");

assert.match(page, /data-member-page="leaderboards"/, "member leaderboard has a dedicated page");
assert.match(page, /id="member-own-rank"/, "member leaderboard provides a separate own-rank card");
assert.match(controller, /db\.rpc\("get_member_habit_leaderboard"/, "browser reads the privacy-safe RPC");
assert.doesNotMatch(controller, /\.from\("habit_logs"\)/, "member browser never downloads facility-wide habit logs");
assert.doesNotMatch(controller, /\.from\("facility_members"\)/, "member browser never downloads the facility roster");
assert.match(controller, /All \$\{programLabel\}/, "the full-program scope is labeled by member program");
assert.match(nav, /key: "leaderboards"/, "leaderboards replace History in the main member navigation");
assert.doesNotMatch(nav, /key: "history"/, "History is not a main member navigation destination");
assert.match(habits, /id="member-weekly-history-list"/, "weekly habit history now lives on the Habits page");
assert.match(dashboard, /href="member-leaderboards\.html"/, "dashboard links members to leaderboards");

console.log("Member leaderboard privacy and structure tests passed");
