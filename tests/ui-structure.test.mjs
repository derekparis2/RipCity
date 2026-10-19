import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const coachPages = {
  "coach-dashboard.html": "dashboard",
  "coach-roster.html": "roster",
  "coach-workouts.html": "workouts",
  "coach-leaderboards.html": "leaderboards",
  "coach-approvals.html": "approvals",
  "coach-member-detail.html": "roster",
  "coach-exercises.html": "workouts",
};

for (const [file, activePage] of Object.entries(coachPages)) {
  const html = await readFile(file, "utf8");
  assert.match(html, new RegExp(`data-coach-nav="${activePage}"`), `${file} has the correct shared coach navigation state`);
  assert.match(html, /js\/coach\/coach-nav\.js\?v=ui-polish-1/, `${file} loads the shared coach navigation`);
}

const dashboard = await readFile("coach-dashboard.html", "utf8");
const roster = await readFile("coach-roster.html", "utf8");
const leaderboardStyles = await readFile("css/coach-leaderboards.css", "utf8");
const profile = await readFile("profile.html", "utf8");
assert.doesNotMatch(dashboard, /data-copy-signup-link/, "signup links are no longer on the coach dashboard");
assert.match(dashboard, /id="coach-review-member-search"/, "workout completion can be filtered by member");
assert.match(roster, /data-copy-signup-link="athlete"/, "roster offers the athlete signup link");
assert.match(roster, /data-copy-signup-link="h2k"/, "roster offers the H2K signup link");
assert.doesNotMatch(roster, /data-copy-signup-link="general"/, "roster does not offer the unused general signup link");
assert.match(roster, /id="create-group-form"/, "group creation remains directly available on the roster");
assert.doesNotMatch(leaderboardStyles, /h2k-header-actions a:not\(:first-child\)/, "mobile leaderboard navigation does not hide coach links");
assert.match(profile, /<details class="panel profile-edit-panel" open>/, "member profile editor is open by default");

const memberHistory = await readFile("member-history.html", "utf8");
assert.match(memberHistory, /id="member-history-hero-description"/, "member history copy can be specialized by member type");
assert.doesNotMatch(memberHistory, /Review recent H2K scores or assigned-workout completion/, "athletes never receive the old mixed H2K description");

const activePages = [
  ...Object.keys(coachPages),
  "login.html",
  "signup.html",
  "set-password.html",
  "pending.html",
  "member-dashboard.html",
  "member-training.html",
  "member-habits.html",
  "member-history.html",
  "member-goals.html",
  "profile.html",
  "workout-session.html",
];

for (const file of activePages) {
  const html = await readFile(file, "utf8");
  assert.match(html, /css\/styles\.css\?v=ui-polish-2/, `${file} loads the current shared stylesheet release`);
}

console.log("UI structure tests passed");
