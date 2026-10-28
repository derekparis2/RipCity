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
  "profile.html": "profile",
};

for (const [file, activePage] of Object.entries(coachPages)) {
  const html = await readFile(file, "utf8");
  assert.match(html, new RegExp(`data-coach-nav="${activePage}"`), `${file} has the correct shared coach navigation state`);
  assert.match(html, /js\/coach\/coach-nav\.js\?v=ui-polish-1/, `${file} loads the shared coach navigation`);
}

const dashboard = await readFile("coach-dashboard.html", "utf8");
const dashboardScript = await readFile("js/coach/coach-dashboard.js", "utf8");
const roster = await readFile("coach-roster.html", "utf8");
const leaderboardStyles = await readFile("css/coach-leaderboards.css", "utf8");
const profile = await readFile("profile.html", "utf8");
assert.doesNotMatch(dashboard, /data-copy-signup-link/, "signup links are no longer on the coach dashboard");
assert.match(dashboard, /id="coach-review-workout-search"/, "workout completion can be searched by assigned workout");
assert.match(dashboard, /id="coach-review-workout-picker"/, "coach chooses one workout assignment to review");
assert.match(dashboard, /id="coach-review-group-filter"/, "selected workout can be filtered by assigned group");
assert.match(dashboard, /id="coach-review-member-search"/, "member search is scoped to the selected workout");
assert.doesNotMatch(dashboard, /id="coach-review-member-type-filter"/, "workout completion no longer uses a redundant member-type filter");
assert.doesNotMatch(dashboard, /id="coach-review-status-filter"/, "member statuses are visible inside each workout instead of filtering the workout list");
assert.match(dashboard, /<details class="panel coach-attention-panel"/, "needs-attention follow-up is collapsible");
assert.match(dashboard, /id="coach-attention-search"/, "needs-attention follow-up is searchable");
assert.match(dashboard, /id="coach-attention-type-filter"/, "needs-attention follow-up can be filtered by program");
assert.match(dashboard, /id="coach-attention-group-filter"/, "needs-attention follow-up can be filtered by group");
assert.doesNotMatch(dashboard, /two missed assigned-workout days/, "needs-attention uses the shared habit rule for both member programs");
assert.doesNotMatch(dashboardScript, /calculateWorkoutAttention\(/, "athletes are no longer added to needs-attention for missed workout entry");
assert.match(dashboardScript, /row\.groupIds\.includes\(groupId\)/, "needs-attention rows can be narrowed to a training group");
assert.match(roster, /data-copy-signup-link="athlete"/, "roster offers the athlete signup link");
assert.match(roster, /data-copy-signup-link="h2k"/, "roster offers the H2K signup link");
assert.doesNotMatch(roster, /data-copy-signup-link="general"/, "roster does not offer the unused general signup link");
assert.match(roster, /id="create-group-form"/, "group creation remains directly available on the roster");
assert.doesNotMatch(leaderboardStyles, /h2k-header-actions a:not\(:first-child\)/, "mobile leaderboard navigation does not hide coach links");
assert.match(profile, /<details class="panel profile-edit-panel" open>/, "member profile editor is open by default");
assert.match(profile, /data-coach-nav="profile"/, "coach profile uses shared coach navigation");
assert.match(profile, /js\/member\/profile\.js\?v=coach-profile-1/, "profile editor supports coach accounts");
const profileScript = await readFile("js/member/profile.js", "utf8");
assert.match(profileScript, /if \(!profileAccess\.isCoach\)/, "coach profiles save without requiring a member profile");
const coachMemberDetail = await readFile("js/coach/coach-member-detail.js", "utf8");
assert.match(coachMemberDetail, /training_focus, favorite_lift/, "coach member detail loads training profile fields");
assert.match(coachMemberDetail, /profile\.bio/, "coach member detail shows the member bio");
assert.match(coachMemberDetail, /if \(editor\) editor\.open = false;/, "coach goal creation starts collapsed on every screen size");

const memberHistory = await readFile("member-history.html", "utf8");
assert.match(memberHistory, /id="member-history-hero-description"/, "member history copy can be specialized by member type");
assert.doesNotMatch(memberHistory, /Review recent H2K scores or assigned-workout completion/, "athletes never receive the old mixed H2K description");
const memberHabits = await readFile("member-habits.html", "utf8");
assert.match(memberHabits, /id="member-weekly-history-list"/, "weekly history is available inside Habits");
const memberLeaderboards = await readFile("member-leaderboards.html", "utf8");
assert.match(memberLeaderboards, /data-member-nav="leaderboards"/, "member leaderboard activates the shared Leaderboards tab");

const activePages = [
  ...Object.keys(coachPages),
  "login.html",
  "signup.html",
  "set-password.html",
  "pending.html",
  "legal-consent.html",
  "member-dashboard.html",
  "member-training.html",
  "member-habits.html",
  "member-history.html",
  "member-leaderboards.html",
  "member-goals.html",
  "profile.html",
  "workout-session.html",
];

const memberNavPages = new Set([
  "member-dashboard.html",
  "member-training.html",
  "member-habits.html",
  "member-history.html",
  "member-leaderboards.html",
  "member-goals.html",
  "profile.html",
  "workout-session.html",
]);

for (const file of activePages) {
  const html = await readFile(file, "utf8");
  const sharedStylesVersion = memberNavPages.has(file)
    ? "member-nav-fixed-1"
    : file === "coach-dashboard.html" ? "attention-habits-1"
      : ["signup.html", "legal-consent.html"].includes(file) ? "signup-legal-2"
        : "ui-polish-4";
  assert.match(html, new RegExp(`css/styles\\.css\\?v=${sharedStylesVersion}`), `${file} loads the current shared stylesheet release`);
}

console.log("UI structure tests passed");
