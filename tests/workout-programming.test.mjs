import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const builderPage = await readFile("coach-workouts.html", "utf8");
const page = await readFile("coach-programming.html", "utf8");
const calendar = await readFile("js/coach/workouts/programming-calendar.js", "utf8");
const programmingPage = await readFile("js/coach/workouts/programming-page.js", "utf8");
const programs = await readFile("js/coach/workouts/programs.js", "utf8");
const history = await readFile("js/coach/workouts/history.js", "utf8");
const migration = await readFile(
  "supabase/migrations/20261108170000_add_workout_programs.sql",
  "utf8"
);
const hardeningMigration = await readFile(
  "supabase/migrations/20261109120000_harden_program_ownership_and_calendar_copy.sql",
  "utf8"
);
const linkedMigration = await readFile(
  "supabase/migrations/20261109210000_link_programs_and_expand_calendar_copy.sql",
  "utf8"
);
const calendarActionMigration = await readFile(
  "supabase/migrations/20261110140000_harden_calendar_assignment_actions.sql",
  "utf8"
);
const isolatedProgramWorkoutMigration = await readFile(
  "supabase/migrations/20261111120000_classify_workouts_and_edit_program_items.sql",
  "utf8"
);
const workoutPageController = await readFile("js/coach/workouts/page.js", "utf8");

assert.match(builderPage, /href="coach-programming\.html\?view=calendar"[^>]*>\s*Workout Calendar</, "Workout Builder links directly to the Workout Calendar");
assert.doesNotMatch(builderPage, /id="workout-programming-panel"/, "Programming is not embedded under the sticky Workout Builder outline");
assert.doesNotMatch(builderPage, /workout-outline-panel[\s\S]*Open Programming/, "Workout Calendar is not mixed into the sticky workout outline");
assert.match(page, /data-coach-nav="programming"/, "Programming has its own shared coach navigation state");
assert.match(page, /<title>Workout Planning<\/title>/, "the calendar and program workspace has a shared planning name");
assert.doesNotMatch(page, /workout-outline-panel/, "Programming does not load the Workout Builder outline");
assert.match(page, /js\/coach\/workouts\/programming-page\.js/, "Programming loads its dedicated page controller");
assert.match(page, /data-programming-view="calendar"/, "Programming includes the programming calendar");
assert.match(page, /data-programming-view="library"/, "Programming keeps a searchable workout library");
assert.match(page, /data-programming-view="programs"/, "Programming includes reusable programs");
assert.match(page, /id="programming-scope-type"[\s\S]*value="group"[\s\S]*value="member"/, "calendar supports group and individual schedules");
assert.match(page, /id="programming-month-label"/, "calendar uses a monthly schedule view");
assert.match(page, /id="copy-programming-month"/, "calendar can copy the current month");
assert.match(page, /id="copy-programming-selected"/, "calendar can copy an arbitrary workout selection");
assert.match(page, /id="programming-copy-destinations"/, "calendar copy supports multiple destination rosters and dates");
assert.match(page, /id="create-program-from-selection"/, "selected calendar workouts can seed a reusable program");
assert.match(page, /id="programming-workout-actions"/, "calendar workouts expose edit and removal actions");
assert.doesNotMatch(calendar, /row\.workout\.focus \|\| "Workout"/, "calendar workout cards only render the workout title");
assert.doesNotMatch(calendar, /row\.sourceLabel\}\$\{row\.isDirect/, "calendar workout cards do not render assignment metadata");
assert.match(calendar, /aria-label="Select \$\{window\.RipCityUI\.attr\(row\.workout\.title\)\} to copy"/, "calendar selection remains accessible without visible helper text");
assert.doesNotMatch(calendar, /<span class="sr-only">Select/, "calendar cards do not leak checkbox helper text into the visible title");
assert.match(page, /id="unassign-programming-selected"/, "calendar supports bulk unassignment");
assert.match(page, /id="program-coach-filter"/, "admins have a program creator filter");
assert.match(page, /id="workout-program-builder"/, "program creation has a real builder form");
assert.match(page, /id="program-duration-weeks"[^>]*max="52"/, "program length supports up to one year");

assert.match(calendar, /target_type === "facility"/, "individual calendars include facility-wide assignments");
assert.match(calendar, /memberGroupIds\.has/, "individual calendars include inherited group assignments");
assert.match(calendar, /new Map\(\)/, "combined member schedules are deduplicated");
assert.match(calendar, /getProgrammingMonthDates/, "calendar renders one month at a time");
assert.match(calendar, /new URLSearchParams\(window\.location\.search\)/, "workspace links can open a specific programming view");
assert.match(calendar, /window\.localStorage\.setItem\(PROGRAMMING_PREFERENCES_KEY/, "calendar filters persist across refreshes");
assert.match(programmingPage, /renderProgrammingScopeOptions\(preferences\.scopeId\)/, "the saved group or member filter is restored after data loads");
assert.match(calendar, /data-copy-calendar-week/, "each populated week can be copied directly from the month");
assert.match(calendar, /row\.isDirect/, "inherited assignments are visible but excluded from direct copying");
assert.match(calendar, /db\.rpc\("copy_workout_programming_assignments"/, "calendar copying uses a transactional database function");
assert.match(calendar, /plannedKeys = new Map/, "calendar copy detects duplicate destinations before saving");
assert.match(calendar, /db\.rpc\("remove_workout_programming_assignment"/, "calendar mistakes can be removed through a protected database function");
assert.match(calendar, /db\.rpc\("get_workout_programming_action_states"/, "calendar loads server-authoritative edit and delete availability");
assert.match(calendar, /db\.rpc\("remove_workout_programming_assignments"/, "calendar bulk unassignment uses a protected database function");
assert.match(calendar, /editAssignment:/, "calendar opens a specific occurrence for editing");
assert.match(workoutPageController, /db\.rpc\("replace_workout_programming_assignment"/, "occurrence editing replaces only the selected assignment snapshot");
assert.match(workoutPageController, /Other dates and assignments will not change/, "occurrence editing explains its isolated scope");

assert.match(programs, /db\.rpc\("save_workout_program"/, "program definitions save through a database function");
assert.match(programs, /db\.rpc\("launch_workout_program"/, "program launches use a transactional database function");
assert.match(programs, /db\.rpc\("archive_workout_program"/, "programs archive without deleting assigned history");
assert.match(programs, /targetType\.value === "group" \? "Group" : "Member"/, "program launch controls distinguish groups and individuals");
assert.match(programs, /check_target_type: targetType/, "the selected group or individual target type is sent to the launch transaction");
assert.match(programs, /programsQuery = programsQuery\.eq\("created_by", workoutCoachAccess\.profile\.id\)/, "ordinary coaches explicitly load only their own programs");
assert.match(programs, /workoutCoachAccess\?\.isAdmin && coachFilter !== "all"/, "admins can filter the facility program list by coach");
assert.match(programs, /Created by/, "admin program cards identify their creator");
assert.match(programs, /data-program-workout-search/, "program workouts use a searchable picker instead of a giant native select");
assert.match(workoutPageController, /replace_workout_program_item_source/, "saved program slots can receive isolated workout edits");
assert.match(programs, /program-launch-history/, "program cards show who and when each program was assigned");
assert.match(history, /\.limit\(500\)/, "calendar and program source lists load a practical workout history window");
assert.match(history, /getReusableWorkoutRows/, "generated program and assignment snapshots stay out of the reusable workout library");

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

assert.match(hardeningMigration, /workout programs owners and admins can read/, "program reads are limited to creators and facility admins");
assert.match(hardeningMigration, /enforce_workout_program_owner_or_admin/, "program updates enforce creator or admin ownership");
assert.match(hardeningMigration, /enforce_workout_program_launch_owner_or_admin/, "program launches enforce creator or admin ownership");
assert.match(hardeningMigration, /copy_workout_programming_assignments/, "selected calendar assignments are copied transactionally");
assert.match(hardeningMigration, /Every copied workout must use the same direct calendar target/, "bulk copies cannot combine unrelated calendar targets");
assert.match(hardeningMigration, /Only direct group or member assignments can be copied/, "inherited facility work cannot be duplicated as a direct assignment");

assert.match(linkedMigration, /add column if not exists assignment_id/, "program launch rows link to their calendar assignments");
assert.match(linkedMigration, /app_private\.refresh_program_workout/, "future linked workouts can refresh from their program source");
assert.match(linkedMigration, /exercise_set_logs/, "started program workouts are protected from later program edits");
assert.match(linkedMigration, /occurrence_date < current_date/, "program edits do not manufacture or rewrite past occurrences");
assert.match(linkedMigration, /check_destinations jsonb/, "calendar copy accepts an explicit multi-destination plan");
assert.match(linkedMigration, /A destination already has a workout/, "calendar copy refuses to overwrite an occupied date");
assert.match(linkedMigration, /drop function if exists public\.copy_workout_programming_assignments\(uuid\[\], date, date\)/, "obsolete single-destination copy RPC is removed");
assert.match(linkedMigration, /Linked program workouts must be changed from the program/, "linked occurrences cannot be independently removed");
assert.match(linkedMigration, /Program item does not belong to this program/, "program updates cannot adopt item ids from another program");

assert.match(calendarActionMigration, /get_workout_programming_action_states/, "calendar action availability is computed by the database");
assert.match(calendarActionMigration, /remove_workout_programming_assignments/, "bulk unassignment is source controlled");
assert.match(calendarActionMigration, /replace_workout_programming_assignment/, "single-occurrence replacement is source controlled");
assert.match(calendarActionMigration, /exercise_set_logs/, "started occurrences are protected from calendar changes");
assert.match(calendarActionMigration, /workout_program_launch_workouts/, "program-linked occurrences are protected from direct changes");
assert.match(calendarActionMigration, /not exists \([\s\S]*workout_assignments/, "unused occurrence snapshots are cleaned up without deleting shared workouts");

assert.match(isolatedProgramWorkoutMigration, /workout_kind/, "workouts are classified as reusable or generated snapshots");
assert.match(isolatedProgramWorkoutMigration, /assignment_snapshot/, "calendar and program launch copies are marked as assignment snapshots");
assert.match(isolatedProgramWorkoutMigration, /replace_workout_program_item_source/, "isolated program-slot editing is source controlled");
assert.match(isolatedProgramWorkoutMigration, /exercise_set_logs/, "started program occurrences are not rewritten by later edits");

console.log("Workout programming calendar and reusable program tests passed");
