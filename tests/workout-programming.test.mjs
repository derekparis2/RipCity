import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("coach-workouts.html", "utf8");
const calendar = await readFile("js/coach/workouts/programming-calendar.js", "utf8");
const programs = await readFile("js/coach/workouts/programs.js", "utf8");
const history = await readFile("js/coach/workouts/history.js", "utf8");
const migration = await readFile(
  "supabase/migrations/20261108170000_add_workout_programs.sql",
  "utf8"
);

assert.match(page, /data-programming-view="calendar"/, "Workout Builder includes the programming calendar");
assert.match(page, /data-programming-view="library"/, "Workout Builder keeps a searchable workout library");
assert.match(page, /data-programming-view="programs"/, "Workout Builder includes reusable programs");
assert.match(page, /id="programming-scope-type"[\s\S]*value="group"[\s\S]*value="member"/, "calendar supports group and individual schedules");
assert.match(page, /id="programming-copy-week-form"/, "calendar includes an explicit copy-week workflow");
assert.match(page, /id="workout-program-builder"/, "program creation has a real builder form");
assert.match(page, /id="program-duration-weeks"[^>]*max="52"/, "program length supports up to one year");

assert.match(calendar, /target_type === "facility"/, "individual calendars include facility-wide assignments");
assert.match(calendar, /memberGroupIds\.has/, "individual calendars include inherited group assignments");
assert.match(calendar, /new Map\(\)/, "combined member schedules are deduplicated");
assert.match(calendar, /db\.rpc\("copy_group_programming_week"/, "week copying uses a transactional database function");

assert.match(programs, /db\.rpc\("save_workout_program"/, "program definitions save through a database function");
assert.match(programs, /db\.rpc\("launch_workout_program"/, "program launches use a transactional database function");
assert.match(programs, /db\.rpc\("archive_workout_program"/, "programs archive without deleting assigned history");
assert.match(programs, /getProgrammingWeekStart/, "program starts are normalized to Monday");
assert.match(programs, /targetType\.value === "group" \? "Group" : "Member"/, "program launch controls distinguish groups and individuals");
assert.match(programs, /check_target_type: targetType/, "the selected group or individual target type is sent to the launch transaction");
assert.match(history, /\.limit\(500\)/, "calendar and program source lists load a practical workout history window");

for (const table of [
  "workout_programs",
  "workout_program_items",
  "workout_program_launches",
  "workout_program_launch_workouts"
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} is source controlled`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
}

assert.match(migration, /app_private\.clone_workout_for_program/, "program launches clone source workouts");
assert.match(migration, /insert into public\.workout_blocks/, "program clones preserve workout blocks");
assert.match(migration, /insert into public\.workout_exercises/, "program clones preserve workout exercises");
assert.match(migration, /insert into public\.workout_assignments/, "launched programs create normal calendar assignments");
assert.match(migration, /Week 1 must start on a Monday/, "database enforces Monday-based program weeks");
assert.match(migration, /Programs may be launched to a group or individual member/, "database rejects unsupported launch targets");
assert.match(migration, /Program workouts must belong to the same facility/, "program definitions cannot use another facility's workouts");
assert.match(migration, /app_private\.is_facility_coach/, "program operations require facility staff authorization");
assert.match(migration, /set archived_at = now\(\)/, "archive preserves program and launch history");

console.log("Workout programming calendar and reusable program tests passed");
