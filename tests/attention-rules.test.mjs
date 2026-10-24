import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(new URL("../js/shared/attention-rules.js", import.meta.url), "utf8"),
  context
);

const rules = context.window.RipCityAttentionRules;
const todayKey = "2026-10-15";

assert.equal(rules.calculateHabitAttention({ logs: [], todayKey }).needsAttention, true);
assert.equal(rules.calculateHabitAttention({
  logs: [],
  todayKey,
  trackingStartDate: "2026-10-14"
}).needsAttention, false, "new members should not inherit missed days from before joining");
assert.equal(rules.calculateHabitAttention({
  logs: [{ log_date: "2026-10-13", completed: true }],
  todayKey
}).needsAttention, false);
assert.deepEqual(
  JSON.parse(JSON.stringify(rules.calculateHabitAttention({
    logs: [{ log_date: todayKey, completed: true }],
    todayKey
  }))),
  { needsAttention: false, consecutiveMisses: 0 }
);

const missedWorkoutDays = [
  { assigned_date: "2026-10-13", hasExerciseData: false },
  { assigned_date: "2026-10-14", hasExerciseData: false },
  { assigned_date: todayKey, hasExerciseData: false }
];
assert.equal(rules.calculateWorkoutAttention({ activity: missedWorkoutDays, todayKey }).needsAttention, true);
assert.equal(rules.calculateWorkoutAttention({
  activity: [...missedWorkoutDays, { assigned_date: todayKey, hasExerciseData: true }],
  todayKey
}).needsAttention, false);
assert.equal(rules.calculateWorkoutAttention({
  activity: [
    { assigned_date: "2026-10-13", hasExerciseData: false },
    { assigned_date: "2026-10-14", hasExerciseData: true }
  ],
  todayKey
}).needsAttention, false);

console.log("attention rule tests passed");
