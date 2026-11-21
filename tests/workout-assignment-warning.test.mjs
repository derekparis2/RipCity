import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const membershipRows = [{ group_id: 'g1', member_profile_id: 'm1' }, { group_id: 'g2', member_profile_id: 'm1' }];
let currentRows = [];
let warning;
let reads = 0;
const query = {
  select() { return this; },
  eq(field, value) { assert.equal(field, 'workout.facility_id'); assert.equal(value, 'facility-1'); return this; },
  in(field, values) { assert.equal(field, 'assigned_date'); assert.ok(values.includes('2026-11-21')); return this; },
  order() { return this; },
  async range() { reads++; return { data: currentRows, error: null }; }
};
const context = vm.createContext({
  window: { confirm: text => { warning = text; return false; } },
  db: { from: table => { assert.equal(table, 'workout_assignments'); return query; } },
  workoutCoachAccess: { membership: { facility_id: 'facility-1' } },
  availableMembers: [{ memberProfileId: 'm1' }],
  loadAssignableGroupMemberships: async () => membershipRows,
  formatDisplayDate: value => value
});
vm.runInContext(await readFile('js/coach/workouts/assignments.js', 'utf8'), context);
const group = id => ({ target_type: 'group', target_group_id: id });
const member = id => ({ target_type: 'member', target_member_profile_id: id });
assert.equal(context.workoutAssignmentTargetsOverlap(group('g1'), group('g2'), membershipRows), true);
assert.equal(context.workoutAssignmentTargetsOverlap(group('g1'), member('m1'), membershipRows), true);
assert.equal(context.workoutAssignmentTargetsOverlap(group('g1'), member('m2'), membershipRows), false);
assert.equal(context.workoutAssignmentTargetsOverlap({ target_type: 'facility' }, member('m2'), membershipRows), true);
const proposed = [{ ...group('g1'), assigned_date: '2026-11-21' }];
assert.equal(await context.confirmWorkoutAssignmentConflicts(proposed), true);
assert.equal(warning, undefined);
currentRows = [{ ...group('g2'), assigned_date: '2026-11-21', workout: { title: 'Existing strength workout' } }];
assert.equal(await context.confirmWorkoutAssignmentConflicts(proposed), false, 'cancel prevents the caller assigning');
assert.match(warning, /Existing strength workout/);
assert.match(warning, /Existing assignments will stay/);
assert.equal(reads, 2, 'each check reads current assignments');
context.window.confirm = () => true;
assert.equal(await context.confirmWorkoutAssignmentConflicts(proposed), true);
console.log('Assignment conflict warning checks passed');
