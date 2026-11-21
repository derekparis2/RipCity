import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const fields = new Map();
function field(selector, value = '', type = 'text') {
  const input = { value, type, checked: false, disabled: false, dataset: {},
    checkValidity: () => true, reportValidity() {}, focus() {} };
  fields.set(selector, input);
  return input;
}
field('.set-weight-input'); field('.set-reps-input');
field('.set-difficulty-input'); field('.set-note-input');
field('.set-completed-input', '', 'checkbox');
const status = { textContent: '' };
const row = {
  dataset: { exerciseId: 'exercise-1', setNumber: '1', inputType: 'weight_reps' },
  querySelector: selector => selector === '.set-log-title em' ? status : fields.get(selector) || null,
  querySelectorAll: () => [...fields.values()], addEventListener() {}
};
const message = { textContent: '', classList: { remove() {}, toggle() {}, add() {} }, setAttribute() {} };
let writes = 0;
let release;
let written;
const document = {
  addEventListener() {},
  getElementById: () => message,
  querySelector: selector => selector === '.session-step-card.active' ? { querySelector: () => row } : row,
  querySelectorAll: selector => selector === '.set-log-row' ? [row] : [...fields.values()]
};
const context = vm.createContext({
  document, URL, Map, console: { error() {} },
  window: { addEventListener() {}, clearTimeout() {}, setTimeout() {}, confirm: () => false },
  db: { from: () => ({ upsert: async log => { writes++; written = log; await new Promise(resolve => { release = resolve; }); return { error: null }; } }) }
});
vm.runInContext(await readFile('js/member/workout-session-core.js', 'utf8'), context);
vm.runInContext(await readFile('js/member/workout-session.js', 'utf8'), context);
vm.runInContext(`
  workoutAssignment = {id:'assignment-1',workout:{}};
  workoutMemberProfile = {id:'member-1'};
  loadExistingSetLogs = async () => [];
  renderWorkoutSession = () => {};
  scrollWorkoutSessionViewIntoPlace = () => {};
  getWorkoutSessionSteps = () => [{},{}];
`, context);

assert.throws(() => context.validateWorkoutSetRow(row), /Enter your result/);
await context.saveSetLog('exercise-1', 1);
assert.equal(writes, 0, 'blank results never reach the database');

fields.get('.set-weight-input').value = '0';
fields.get('.set-reps-input').value = '8';
row.dataset.dirty = 'true';
context.captureWorkoutSetDraft(row);
fields.get('.set-reps-input').value = '';
context.restoreWorkoutSetDrafts();
assert.equal(fields.get('.set-reps-input').value, '8', 'draft restoration retains typed results');
assert.equal(status.textContent, 'Unsaved changes');
assert.equal(context.confirmDiscardWorkoutDrafts(), false, 'refresh can be cancelled without discarding drafts');

const saving = context.saveSetLog('exercise-1', 1);
assert.equal(writes, 1);
await context.saveSetLog('exercise-1', 1);
assert.equal(writes, 1, 'a second save cannot overlap the first');
release();
await saving;
assert.equal(written.weight, 0, 'bodyweight zero is retained');
assert.equal(written.reps_completed, 8);
assert.equal(written.completed, true);
assert.equal(row.dataset.dirty, 'false');
assert.equal(fields.get('.set-reps-input').disabled, false, 'controls recover after saving');
assert.equal(vm.runInContext('workoutSetDrafts.size', context), 0);

row.dataset.inputType = 'completion';
fields.get('.set-completed-input').checked = false;
assert.throws(() => context.validateWorkoutSetRow(row), /Mark this set completed/);
fields.get('.set-completed-input').checked = true;
assert.equal(context.validateWorkoutSetRow(row).completed, true);
assert.equal(context.getWorkoutDemoUrl('javascript:alert(1)'), '');
assert.equal(context.getWorkoutDemoUrl('https://example.com/demo'), 'https://example.com/demo');
console.log('Member workout flow checks passed');

// Empty sets can advance, then Finish must ask before leaving them incomplete.
vm.runInContext(`
  updateWorkoutSessionHistory = () => {};
  workoutSessionView = "logging";
  getWorkoutSessionSteps = () => [
    {exercise:{id:'exercise-1',input_type:'completion'},setNumber:1},
    {exercise:{id:'exercise-1',input_type:'completion'},setNumber:2}
  ];
  goToSessionStep = index => { window.nextStep = index; };
`, context);
fields.get('.set-completed-input').checked = false;
row.dataset.dirty = 'false';
const writesBeforeFinish = writes;
await context.saveCurrentSetAndGoToStep(1);
assert.equal(context.window.nextStep, 1);
assert.equal(writes, writesBeforeFinish);
let warning;
context.window.confirm = text => { warning = text; return false; };
await context.finishWorkoutSession();
assert.match(warning, /2 of 2 sets are incomplete/);
assert.equal(vm.runInContext('workoutSessionView', context), 'logging', 'cancel stays in the workout');
context.window.confirm = () => true;
await context.finishWorkoutSession();
assert.equal(vm.runInContext('workoutSessionView', context), 'summary');
assert.equal(writes, writesBeforeFinish, 'Finish does not mark untouched sets completed');
row.dataset.inputType = 'weight_reps';
fields.get('.set-weight-input').value = '25';
fields.get('.set-reps-input').value = '';
const partial = context.validateWorkoutSetRow(row, true);
assert.equal(partial.weight, 25);
assert.equal(partial.completed, false, 'partial results can be saved without completing the set');
vm.runInContext('workoutSessionView = "logging"; loadExistingSetLogs = async () => { throw new Error("Connection lost"); };', context);
await context.finishWorkoutSession();
assert.equal(vm.runInContext('workoutSessionView', context), 'logging', 'a failed finish stays in the workout');
assert.equal(vm.runInContext('workoutSessionSaving', context), false, 'finish errors release the save lock');
