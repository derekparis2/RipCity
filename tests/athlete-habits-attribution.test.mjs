import assert from "node:assert/strict";
import fs from "node:fs";

const memberNav = fs.readFileSync("js/member/member-nav.js", "utf8");
const memberDashboard = fs.readFileSync("js/member/member-dashboard.js", "utf8");
const workoutData = fs.readFileSync("js/shared/workout-data.js", "utf8");
const workoutHistory = fs.readFileSync("js/coach/workouts/history.js", "utf8");
const coachLeaderboards = fs.readFileSync("js/coach/coach-leaderboards.js", "utf8");
const coachMemberHistory = fs.readFileSync("js/coach/member-history.js", "utf8");
const leaderboardSeed = fs.readFileSync(
  "supabase/seeds/staging/v2/03_leaderboard_demo_data.sql",
  "utf8"
);
const attributionMigration = fs.readFileSync(
  "supabase/migrations/20261023180000_add_workout_attribution_rpc.sql",
  "utf8"
);

assert.doesNotMatch(memberNav, /h2kOnly:\s*true/, "athlete navigation includes Habits");
assert.doesNotMatch(
  memberDashboard,
  /page === "habits" && !isH2K/,
  "athletes are not redirected away from Habits"
);
assert.match(
  memberDashboard,
  /const needsHabits = \["dashboard", "habits", "history"\]\.includes\(page\)/,
  "all member pages load shared habit data where needed"
);
assert.match(memberDashboard, /Habit Score/, "member weekly history uses shared habit scoring");
assert.match(
  coachLeaderboards,
  /athlete:\s*"fourWeekAverage"/,
  "athlete leaderboards default to the same habit average as H2K"
);
assert.doesNotMatch(
  coachLeaderboards,
  /calculateAthleteMetrics/,
  "athlete leaderboard no longer ranks assigned-workout attendance"
);
assert.match(
  coachMemberHistory,
  /historyData = await loadHabitHistory\(memberProfile\)/,
  "coach member history uses habits for both member programs"
);
assert.match(
  leaderboardSeed,
  /'42000000-0000-4000-8000-000000000011'::uuid, 42, 7/,
  "staging seed creates athlete habit leaderboard fixtures"
);
assert.match(
  workoutData,
  /rpc\("get_workout_attributions"/,
  "member workout data loads safe attribution names"
);
assert.match(workoutHistory, /Created by/, "coach workout history shows workout creator");
assert.match(workoutHistory, /Assigned by/, "coach workout history shows assignment creator");
assert.match(
  attributionMigration,
  /app_private\.can_view_workout_assignment\(wa\.id\)/,
  "attribution RPC preserves assignment visibility rules"
);
assert.match(
  attributionMigration,
  /grant execute on function public\.get_workout_attributions\(uuid\[\]\) to authenticated/,
  "only authenticated users receive attribution access"
);

console.log("Athlete habit and workout attribution tests passed");
