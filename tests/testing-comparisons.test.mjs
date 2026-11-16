import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(new URL("../js/shared/testing-comparisons.js", import.meta.url), "utf8"),
  context
);

const comparisons = context.window.RipCityTestingComparisons;

function participation({
  id,
  date,
  dayStatus = "completed",
  participationStatus = "participated",
  testName,
  unit,
  direction,
  value,
  resultStatus = "recorded"
}) {
  return {
    id: `participant-${id}`,
    participation_status: participationStatus,
    testing_day: {
      id: `day-${id}`,
      name: `Testing Day ${id}`,
      testing_date: date,
      status: dayStatus,
      testing_day_tests: [{
        id: `test-${id}`,
        name: testName,
        unit,
        input_type: "number",
        ranking_direction: direction,
        testing_results: [{
          id: `result-${id}`,
          testing_day_participant_id: `participant-${id}`,
          result_status: resultStatus,
          numeric_value: value,
          recorded_at: `${date}T15:00:00Z`
        }]
      }]
    }
  };
}

const strengthHistory = [
  participation({ id: "strength-1", date: "2026-01-10", testName: "Bench Press", unit: "lb", direction: "higher", value: 100 }),
  participation({ id: "strength-2", date: "2026-02-10", testName: "Bench Press", unit: "lb", direction: "higher", value: 120 }),
  participation({ id: "strength-3", date: "2026-03-10", testName: "Bench Press", unit: "lb", direction: "higher", value: 115 })
];
const [strength] = comparisons.build(strengthHistory);
assert.equal(strength.baseline.value, 100, "earliest official result is the baseline");
assert.equal(strength.previous.value, 120, "immediately prior official result is previous");
assert.equal(strength.latest.value, 115, "newest official result is latest");
assert.equal(strength.best.value, 120, "higher-is-better PR uses the maximum result");
assert.equal(strength.improvementFromPrevious, -5, "regression from previous is negative");
assert.equal(strength.improvementFromBaseline, 15, "improvement from baseline is direction-aware");
assert.equal(strength.percentFromBaseline, 15);
assert.equal(strength.isPersonalRecord, false);

const tiedRecord = comparisons.build([
  participation({ id: "tie-1", date: "2026-01-10", testName: "Exit Velocity", unit: "mph", direction: "higher", value: 90 }),
  participation({ id: "tie-2", date: "2026-02-10", testName: "Exit Velocity", unit: "mph", direction: "higher", value: 90 })
])[0];
assert.equal(tiedRecord.isPersonalRecord, true, "matching an existing best still identifies the latest result as a PR");

const speedHistory = [
  participation({ id: "speed-1", date: "2026-01-10", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 3 }),
  participation({ id: "speed-skipped", date: "2026-02-01", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 2.6, resultStatus: "not_tested" }),
  participation({ id: "speed-scheduled", date: "2026-02-15", dayStatus: "scheduled", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 2.5 }),
  participation({ id: "speed-absent", date: "2026-02-20", participationStatus: "did_not_participate", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 2.4 }),
  participation({ id: "speed-2", date: "2026-03-10", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 2.7 })
];
const [speed] = comparisons.build(speedHistory);
assert.equal(speed.resultCount, 2, "not-tested, scheduled, and absent outcomes are excluded");
assert.equal(speed.best.value, 2.7, "lower-is-better PR uses the minimum result");
assert.ok(Math.abs(speed.improvementFromBaseline - 0.3) < 0.000001);
assert.ok(Math.abs(speed.percentFromBaseline - 10) < 0.000001);
assert.equal(speed.isPersonalRecord, true);

const separatedUnits = comparisons.build([
  participation({ id: "jump-in", date: "2026-01-10", testName: "Broad Jump", unit: "inches", direction: "higher", value: 80 }),
  participation({ id: "jump-cm", date: "2026-02-10", testName: "Broad Jump", unit: "cm", direction: "higher", value: 205 })
]);
assert.equal(separatedUnits.length, 2, "results with different units never form a false comparison");

const missingNumericResult = participation({
  id: "missing-value",
  date: "2026-02-10",
  testName: "Exit Velocity",
  unit: "mph",
  direction: "higher",
  value: null
});
assert.equal(comparisons.build([missingNumericResult]).length, 0, "missing numeric results never become zeroes");

const zeroBaseline = comparisons.build([
  participation({ id: "zero-1", date: "2026-01-10", testName: "Score", unit: "points", direction: "higher", value: 0 }),
  participation({ id: "zero-2", date: "2026-02-10", testName: "Score", unit: "points", direction: "higher", value: 5 })
])[0];
assert.equal(zeroBaseline.percentFromBaseline, null, "zero baselines do not produce misleading percentages");
assert.equal(comparisons.formatImprovement(-5, "lb"), "−5 lb");
assert.equal(comparisons.formatPercent(12.345), "+12.3%");

const listOrder = comparisons.build([
  participation({ id: "older", date: "2026-02-10", testName: "Bench Press", unit: "lb", direction: "higher", value: 120 }),
  participation({ id: "newer", date: "2026-04-10", testName: "10-Yard Sprint", unit: "seconds", direction: "lower", value: 2.7 })
]);
assert.deepEqual(
  Array.from(comparisons.filterAndSort(listOrder, "", "recent"), item => item.testName),
  ["10-Yard Sprint", "Bench Press"],
  "comparison lists default to the most recently updated test"
);
assert.deepEqual(
  Array.from(comparisons.filterAndSort(listOrder, "bench", "name"), item => item.testName),
  ["Bench Press"],
  "comparison lists can search test names and sort alphabetically"
);

console.log("testing comparison tests passed");
