import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workoutPage = await readFile("coach-workouts.html", "utf8");
const programmingPage = await readFile("coach-programming.html", "utf8");
const workoutAssignments = await readFile("js/coach/workouts/assignments.js", "utf8");
const workoutHistory = await readFile("js/coach/workouts/history.js", "utf8");
const testingPage = await readFile("coach-testing.html", "utf8");
const testingController = await readFile("js/coach/coach-testing.js", "utf8");
const coachAnnouncements = await readFile("js/coach/coach-announcements.js", "utf8");
const memberAnnouncements = await readFile("js/member/member-announcements.js", "utf8");
const announcementMigration = await readFile(
  "supabase/migrations/20261104120000_preserve_announcement_author_names.sql",
  "utf8"
);

assert.match(workoutPage, /id="add-workout-date-btn"/, "new workouts expose the add-date control");
assert.match(workoutPage, /id="workout-selected-dates"/, "new workouts render selected dates");
assert.match(workoutAssignments, /function getWorkoutAssignedDates\(/, "new workout assignment collects multiple dates");
assert.match(workoutAssignments, /dates\.flatMap\(date =>/, "assignment rows are created for every selected date");
assert.match(workoutHistory, /data-add-reuse-date=/, "Assign Again exposes multiple dates");
assert.match(workoutAssignments, /function getExistingWorkoutDates\(/, "Assign Again collects multiple dates");
assert.match(programmingPage, /id="recent-workout-assigner-filter"/, "workout history can filter by assigning staff member");
assert.match(workoutHistory, /row\.assigned_by === filters\.assignerId/, "the assigned-by filter uses assignment attribution");

assert.match(coachAnnouncements, /author_display_name/, "coach announcement history selects author snapshots");
assert.match(memberAnnouncements, /author_display_name/, "member announcements select author snapshots");
assert.match(announcementMigration, /create trigger set_announcement_author_display_name/, "announcement author snapshots are maintained by the database");
assert.match(announcementMigration, /alter column author_display_name set not null/, "all announcements receive an attribution value");

assert.match(testingPage, /id="testing-group-filter"/, "Testing Days can filter by group");
assert.match(testingPage, /id="testing-creator-filter"/, "Testing Days can filter by creator");
assert.match(testingController, /data-testing-action="remove"/, "empty Testing Days expose removal");
assert.match(testingController, /savedOutcomes === 0/, "Testing Days with results cannot be removed");
assert.match(testingController, /rpc\("delete_testing_day"/, "removal uses the guarded database RPC");

console.log("Production workflow hotfix tests passed");
