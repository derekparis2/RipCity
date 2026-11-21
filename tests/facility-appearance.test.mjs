import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(await readFile('js/shared/facility-appearance.js', 'utf8'), context);
const appearance = context.window.FacilityAppearance;
assert.equal(appearance.normalize().style, 'performance', 'existing facilities retain Performance');
assert.equal(appearance.normalize().background, 'default');
assert.equal(appearance.normalize({ style: 'unknown' }).style, 'performance');
assert.equal(appearance.contrast('#ffffff'), '#101114');
assert.equal(appearance.contrast('#101114'), '#ffffff');

// The dashboard renderer must preserve unmarked content and module-hidden state
// when an owner reorders or hides sections, including repeat application.
const parent = {
  children: [],
  replaceChild(replacement, original) {
    const index = this.children.indexOf(original);
    assert.notEqual(index, -1);
    this.children[index] = replacement;
    replacement.parentElement = this;
  }
};
function section(key, hidden = false) {
  return { dataset: { dashboardSection: key }, hidden, parentElement: parent, attributes: new Set(),
    toggleAttribute(name, enabled) { if (enabled) this.attributes.add(name); else this.attributes.delete(name); }
  };
}
const header = { id: 'unmarked-header' };
const welcome = section('welcome');
const announcements = section('announcements', true);
const feedback = section('feedback');
const scores = section('scores');
const tools = section('tools');
parent.children = [header, welcome, announcements, feedback, scores, tools];
const root = { dataset: {}, style: { setProperty() {} } };
const doc = {
  documentElement: root,
  querySelectorAll(selector) { return selector.includes('"member"') ? parent.children.filter(node => node.dataset) : []; },
  createComment() { return {}; }
};
const config = { appearance_settings: {
  style: 'community', background: 'dark',
  member_order: ['announcements', 'welcome', 'tools', 'scores', 'feedback'], member_hidden: ['feedback']
} };
appearance.apply(config, doc);
assert.equal(parent.children[0], header);
assert.deepEqual(parent.children.slice(1).map(node => node.dataset.dashboardSection), config.appearance_settings.member_order);
assert.equal(feedback.attributes.has('data-appearance-hidden'), true);
assert.equal(announcements.hidden, true, 'presentation never re-enables a disabled module');
appearance.apply(config, doc);
assert.equal(parent.children[0], header);
assert.equal(root.dataset.facilityStyle, 'community');
appearance.apply({}, doc);
assert.equal(feedback.attributes.has('data-appearance-hidden'), false);
assert.equal(root.dataset.facilityStyle, 'performance');
assert.equal(announcements.hidden, true);
console.log('Facility appearance checks passed');
