import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {
  console,
  document: { addEventListener() {} },
  window: {
    RipCityWorkoutData: {
      summarizeSetLogs(logs) {
        return {
          completedSets: logs.length,
          totalSets: 2,
          completionPercent: logs.length * 50,
          isComplete: logs.length === 2,
          lastLoggedAt: logs.at(-1)?.created_at || null
        };
      }
    }
  }
};

vm.createContext(context);
vm.runInContext(
  fs.readFileSync(new URL("../js/coach/coach-dashboard.js", import.meta.url), "utf8"),
  context
);

const workout = { id: "workout-1", title: "Shared Workout" };
const assignments = ["assignment-1", "assignment-2"].map(id => ({
  id,
  assigned_date: "2026-10-19",
  target_type: "facility",
  target_facility_id: "facility-1",
  workout
}));
const members = [{
  facilityMemberId: "membership-1",
  memberProfileId: "member-1",
  memberType: "athlete",
  name: "Test Athlete"
}];
const logs = assignments.map((assignment, index) => ({
  id: `log-${index + 1}`,
  workout_assignment_id: assignment.id,
  member_profile_id: "member-1",
  created_at: `2026-10-19T1${index}:00:00Z`
}));

const rows = context.buildCoachWorkoutReviewRows(
  assignments,
  members,
  [],
  logs,
  "facility-1"
);

assert.equal(rows.length, 1, "same workout and date render as one review card");
assert.equal(rows[0].assignments.length, 2, "the grouped card retains both assignments");
assert.equal(rows[0].assignedMembers.length, 1, "overlapping assignment targets show a member once");
assert.equal(rows[0].assignedMembers[0].logs.length, 2, "logs from grouped assignments stay available");
assert.equal(rows[0].assignedMembers[0].summary.isComplete, true, "grouped logs produce the combined completion summary");

console.log("coach workout review tests passed");
