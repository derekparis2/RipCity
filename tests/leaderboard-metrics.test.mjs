import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(new URL("../js/shared/leaderboard-metrics.js", import.meta.url), "utf8"),
  context
);

const metrics = context.window.RipCityMetrics;
const todayKey = "2026-10-15";
const habitLogs = [];

["2026-10-13", "2026-10-14", "2026-10-15"].forEach(dateKey => {
  for (let index = 1; index <= 4; index += 1) {
    habitLogs.push({ habit_id: `habit-${index}`, log_date: dateKey, completed: true, points_earned: 1 });
  }
});

["2026-10-05", "2026-09-28", "2026-09-21", "2026-09-14"].forEach(dateKey => {
  for (let index = 1; index <= 7; index += 1) {
    habitLogs.push({ habit_id: `weekly-${index}`, log_date: dateKey, completed: true, points_earned: 1 });
  }
});

const h2k = metrics.calculateH2KMetrics({ logs: habitLogs, habitCount: 6, todayKey });
assert.equal(h2k.todayScore, 4);
assert.equal(h2k.currentWeekScore, 12);
assert.equal(h2k.currentWeekQualifiedDays, 3);
assert.equal(h2k.fourWeekAverage, 7);
assert.equal(h2k.currentStreak, 3);

const currentWeekOnly = metrics.calculateH2KMetrics({
  logs: habitLogs.filter(log => log.log_date >= "2026-10-12"),
  habitCount: 6,
  todayKey
});
assert.equal(currentWeekOnly.fourWeekAverage, null, "current partial week must not create a rolling score");
assert.equal(currentWeekOnly.hasScore, false);

const athlete = metrics.calculateAthleteMetrics({
  todayKey,
  assignments: [
    { assigned_date: "2026-09-28", isComplete: true },
    { assigned_date: "2026-10-01", isComplete: false },
    { assigned_date: "2026-10-05", isComplete: true },
    { assigned_date: "2026-10-08", isComplete: true },
    { assigned_date: "2026-10-12", isComplete: true },
    { assigned_date: "2026-10-15", isComplete: false }
  ]
});
assert.deepEqual(JSON.parse(JSON.stringify(athlete.currentWeek)), { assigned: 2, completed: 1, percent: 50 });
assert.deepEqual(JSON.parse(JSON.stringify(athlete.fourWeek)), { assigned: 4, completed: 3, percent: 75 });
assert.equal(athlete.currentStreak, 3, "unfinished today must not break the active streak");
assert.equal(athlete.longestStreak, 3);

const noAssignments = metrics.calculateAthleteMetrics({ assignments: [], todayKey });
assert.equal(noAssignments.currentWeek.percent, null);
assert.equal(noAssignments.fourWeek.percent, null);

const ranked = metrics.assignCompetitionRanks(
  [{ score: 10 }, { score: 10 }, { score: 5 }, { score: null }],
  row => row.score
);
assert.deepEqual(Array.from(ranked, row => row.rank), [1, 1, 3, null]);

console.log("leaderboard metrics tests passed");
