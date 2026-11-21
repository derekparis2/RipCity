import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { hidden: false, dataset: {}, textContent: '', bound: 0,
    classList: { toggle() {} }, addEventListener() { this.bound++; }, closest() { return node('recovery-footer'); } });
  return nodes.get(id);
}
let session = { user: { id: 'existing-user', email: 'member@example.com' } };
const routes = [];
const choices = [];
const context = vm.createContext({
  document: { getElementById: node, addEventListener() {} },
  window: {}, console,
  db: { auth: { getSession: async () => ({ data: { session }, error: null }) } }
});
vm.runInContext(await readFile('js/auth/auth.js', 'utf8'), context);
context.withAuthTimeout = request => request;
context.redirectByProfile = async (id, options) => routes.push({ id, options });
context.showSessionActions = (page, user, registration) => choices.push({ page, user, registration });
context.loadLoginFacility = async () => {};
await context.setupLoginPage();
assert.equal(node('login-form').hidden, true);
assert.equal(routes[0].id, 'existing-user');
assert.equal(routes[0].options.preferPlatform, true);
assert.equal(node('login-form').bound, 0, 'credentials cannot be submitted during routing');

session = null;
await context.setupLoginPage();
assert.equal(node('login-form').hidden, false);
assert.equal(node('recovery-footer').hidden, false);
await context.setupLoginPage();
assert.equal(node('login-form').bound, 1, 'repeat initialization does not duplicate submit listeners');

session = { user: { id: 'existing-user' } };
context.setSignupSubmitDisabled = () => {};
await context.setupSignupPage();
assert.equal(node('signup-form').hidden, true);
assert.equal(choices.at(-1).page, 'signup');
assert.equal(choices.at(-1).registration, true, 'signed-in registration requires an explicit account choice');
context.db.auth.getSession = async () => { throw new Error('Session unavailable'); };
await context.setupLoginPage();
assert.equal(node('login-form').hidden, true);
assert.match(node('login-message').textContent, /Session unavailable/);
console.log('Existing-session auth routing checks passed');
