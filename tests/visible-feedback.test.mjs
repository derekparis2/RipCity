import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.attributes = {}; this.handlers = {};
    this.hidden = false; this.isConnected = true; this.textContent = '';
    const classes = new Set();
    this.classList = { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, remove(name) { classes.delete(name); } };
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  remove() { this.parent.children = this.parent.children.filter(node => node !== this); this.isConnected = false; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { document.activeElement = this; }
}
const trigger = new Element();
const document = { body: new Element(), activeElement: trigger, createElement: () => new Element() };
let logoutCalls = 0;
const context = vm.createContext({ document, window: { setTimeout, clearTimeout,
  db: { auth: { signOut: async () => { logoutCalls++; return { error: new Error('Network unavailable') }; } } }
} });
vm.runInContext(await readFile('js/shared/feedback.js', 'utf8'), context);
const feedback = context.window.AppFeedback;
feedback.show(null, 'Startup failed', true, { key: 'startup' });
const region = document.body.children[0];
assert.equal(region.hidden, false, 'missing inline target cannot hide a startup error');
assert.equal(region.children[0].children[0].textContent, 'Startup failed');
assert.equal(document.activeElement, trigger, 'errors do not steal input focus');
feedback.show(null, '', false, { key: 'startup' });
assert.equal(region.children.length, 1, 'an empty refresh does not erase the error');
feedback.show(null, 'Checking again...', false, { key: 'startup' });
assert.equal(region.hidden, true, 'a retry clears its previous error');
const inline = new Element();
feedback.show(inline, 'Could not save', true, { key: 'save' });
feedback.show(inline, 'Could not save again', true, { key: 'save' });
assert.equal(region.children.length, 1, 'repeat errors from one action do not stack duplicates');
const close = region.children[0].children[1];
close.focus();
close.handlers.click();
assert.equal(region.hidden, true);
assert.equal(inline.hidden, true);
assert.equal(document.activeElement, trigger, 'dismiss returns focus to the original control');
assert.equal(await feedback.signOut(), false, 'a logout failure keeps the user on the current page');
assert.equal(logoutCalls, 1);
assert.equal(region.hidden, false);
context.window.db.auth.signOut = async () => ({ error: null });
assert.equal(await feedback.signOut(), true);
assert.equal(region.hidden, true);
console.log('Visible feedback checks passed');
