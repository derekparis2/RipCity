import assert from "node:assert/strict";
import { createRequire } from "node:module";

const lifts = createRequire(import.meta.url)("../js/shared/lift-maxes.js");

assert.equal(lifts.estimateOneRepMax(225, 1), 225, "a single is the max");
assert.equal(Math.round(lifts.estimateOneRepMax(200, 5)), 233, "Epley estimate for a set of five");
assert.equal(lifts.estimateOneRepMax(200, 15), null, "high-rep sets are too unreliable to estimate");
assert.equal(lifts.estimateOneRepMax(0, 3), null, "empty weight is ignored");

const maxes = lifts.computeMaxesByExercise([
  { exercise_name: "Back Squat", weight: 300, reps_completed: 1, is_max_effort: true, completed: true },
  { exercise_name: "back  squat", weight: 315, reps_completed: 1, is_max_effort: false, completed: true },
  { exercise_name: "Back Squat", weight: 280, reps_completed: 1, is_max_effort: true, completed: true },
  { exercise_name: "Bench", weight: 200, reps_completed: 3, is_max_effort: true, completed: false }
]);
assert.equal(maxes.get("back squat"), 300, "only max-effort sets count and the best one wins");
assert.equal(maxes.has("bench"), false, "incomplete sets do not count");

assert.deepEqual(lifts.parsePercentTargets("70, 75%, 80"), [70, 75, 80]);
assert.deepEqual(lifts.parsePercentTargets("abc"), []);
assert.equal(lifts.getPercentForSet("70,75,80", 2), 75);
assert.equal(lifts.getPercentForSet("70,75", 4), 75, "later sets reuse the last percentage");
assert.equal(lifts.getPercentForSet("", 1), null);

assert.equal(lifts.calculateLoad(300, 50), 150);
assert.equal(lifts.calculateLoad(233, 70), 165, "loads round to the nearest 5");
assert.equal(lifts.calculateLoad(null, 70), null);
assert.equal(lifts.calculatePercentOfMax(225, 300), 75);

console.log("lift-maxes tests passed");
