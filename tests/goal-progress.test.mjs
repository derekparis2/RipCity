import "../js/shared/goal-progress.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const activeGoal = {
  status: "active",
  current_value: 0,
  target_value: 6,
  unit: "Days"
};
const completedGoal = { ...activeGoal, status: "completed" };
const checkins = [
  { recorded_date: "2026-09-16", value: 7 },
  { recorded_date: "2026-09-14", value: 1 },
  { recorded_date: "2026-09-15", value: 2 }
];

const activeValues = globalThis.RipCityGoalProgress.getGoalValues(activeGoal, checkins);
assert(activeValues.startValue === 0, "active goal preserves its starting value");
assert(activeValues.currentValue === 7, "active goal uses its latest dated check-in");
assert(activeValues.currentLabel === "Current", "active goal labels the latest value as current");
assert(
  globalThis.RipCityGoalProgress.formatGoalValueSummary(activeGoal, checkins) === "Start 0 · Current 7 · Target 6 Days",
  "active goal summary shows start, current, and target"
);

const completedValues = globalThis.RipCityGoalProgress.getGoalValues(completedGoal, checkins);
assert(completedValues.currentValue === 7, "completed goal preserves the latest check-in as its finish");
assert(completedValues.currentLabel === "Finish", "completed goal labels the latest value as finish");
assert(
  globalThis.RipCityGoalProgress.formatGoalValueSummary(completedGoal, checkins) === "Start 0 · Finish 7 · Target 6 Days",
  "completed goal summary shows start, finish, and target"
);

const noCheckinValues = globalThis.RipCityGoalProgress.getGoalValues(activeGoal, []);
assert(noCheckinValues.currentValue === 0, "goal without check-ins falls back to its starting value");

console.log("goal progress tests passed");
