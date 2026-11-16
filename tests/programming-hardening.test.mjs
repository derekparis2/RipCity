import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calendar = await readFile('js/coach/workouts/programming-calendar.js', 'utf8');
const history = await readFile('js/coach/workouts/history.js', 'utf8');
const page = await readFile('js/coach/workouts/page.js', 'utf8');
const migration = await readFile('supabase/migrations/20261116120000_harden_programming_security_and_lifecycle.sql', 'utf8');
const elements = {
  'programming-scope-type': { value: 'group' },
  'programming-scope-id': { value: 'roster-a' }
};
const pending = [];
let rendered = 0;
const context = vm.createContext({
  console, URL, Date,
  document: { getElementById: id => elements[id], addEventListener() {} },
  window: { location: { href: 'https://example.com/coach-workouts.html' } },
  db: { rpc: () => new Promise(resolve => pending.push(resolve)) }
});
vm.runInContext(calendar, context);
vm.runInContext('renderProgrammingCalendar = () => onRender()', context);
context.onRender = () => rendered++;
const first = vm.runInContext('refreshProgrammingActionStates([{assignment:{id:"a"}}])', context);
elements['programming-scope-id'].value = 'roster-b';
const second = vm.runInContext('refreshProgrammingActionStates([{assignment:{id:"b"}}])', context);
pending[1]({ data: [{ assignment_id: 'b', can_edit: true }] });
await second;
pending[0]({ data: [{ assignment_id: 'a', can_edit: true }] });
await first;
assert.equal(rendered, 1);
assert.equal(vm.runInContext('programmingActionStates.has("b") && !programmingActionStates.has("a")', context), true);

// A spring-forward week contains 167 hours but still represents one calendar week.
const previousTimezone = process.env.TZ;
process.env.TZ = 'America/New_York';
vm.runInContext(`
  getSelectedProgrammingRows = () => [
    {assignment:{assigned_date:'2026-03-02'},workout:{id:'one'}},
    {assignment:{assigned_date:'2026-03-09'},workout:{id:'two'}}
  ];
  setProgrammingView = () => {};
  openProgramBuilder = (_, options) => { capturedProgram = options; };
  createProgramFromProgrammingSelection();
`, context);
assert.equal(context.capturedProgram.durationWeeks, 2);
assert.equal(context.capturedProgram.items[1].week_number, 2);
if (previousTimezone === undefined) delete process.env.TZ;
else process.env.TZ = previousTimezone;

vm.runInContext(page.split('// =====================================================')[0], context);
const safeReturn = value => context.getSafeProgrammingReturnUrl(value);
assert.equal(safeReturn('coach-programming.html?view=programs'), 'coach-programming.html?view=programs');
for (const url of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'https://evil.example/coach-programming.html']) {
  assert.equal(safeReturn(url), 'coach-programming.html');
}

// Exercise actual pagination across the former total cap.
const fixtures = Array.from({ length: 601 }, (_, id) => ({ id }));
let requests = 0;
context.workoutCoachAccess = { membership: { facility_id: 'facility' } };
context.db = { from() {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; },
    async range(start, end) { requests++; return { data: fixtures.slice(start, end + 1), error: null }; } };
  return query;
} };
vm.runInContext(history, context);
const result = await context.fetchRecentWorkoutRows();
assert.equal(result.data.length, 601);
assert.equal(requests, 4);

assert.ok(migration.indexOf('pg_advisory_xact_lock') < migration.indexOf('A destination already has a workout'));
assert.match(migration, /workout\.workout_kind = 'assignment_snapshot'/);
assert.match(migration, /new\.created_by is distinct from old\.created_by/);
assert.match(migration, /tg_op = 'DELETE' and not exists/);
assert.match(migration, /item_row\.source_workout_id, program_row\.created_by/);
assert.match(migration, /delete from public\.workout_exercises where workout_id = check_workout_id/);
assert.match(migration, /drop function if exists public\.copy_group_programming_week/);
console.log('Programming hardening runtime and migration contract checks passed');
