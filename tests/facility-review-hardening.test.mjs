import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(path, 'utf8');
const platform = await read('js/platform/platform.js');
const auth = await read('js/auth/auth.js');
const dashboard = await read('js/coach/coach-dashboard.js');
const migration = await read('supabase/migrations/20261117120000_harden_facility_onboarding.sql');
const approval = await read('js/coach/coach-approvals.js');
const training = await read('member-training.html');
const member = await read('js/member/member-dashboard.js');

// Execute the production payload builder with non-empty per-module settings.
const element = { classList: { add() {}, remove() {} }, addEventListener() {} };
const platformContext = vm.createContext({
  document: { getElementById: () => element },
  window: {}, structuredClone,
  FormData: class { get() { return ''; } }
});
const platformUnderTest = platform.slice(0, platform.indexOf('  document.getElementById("open-create-facility-btn")'))
  + 'window.testApi = { readPayload, normalizeConfig }; })();';
vm.runInContext(platformUnderTest, platformContext);
const config = platformContext.window.testApi.normalizeConfig({ modules: [{ module_key: 'workouts', enabled: true, settings: { rounding: 5 } }] });
const form = { facilityProgramKeys:["athlete","h2k"], elements: {content_show_feedback:{checked:true},content_show_scores:{checked:true}}, facilityModuleSettings: structuredClone(config.modules) };
for (const key of ['workouts','habits','goals','leaderboards','announcements','testing_days']) {
  form.elements[`module_${key}`] = { checked: true };
  form.elements[`program_${key}_enabled`] = { checked: true };
}
for (const key of ['athlete','h2k']) form.elements[`program_${key}_enabled`] = { checked: true };
const payload = platformContext.window.testApi.readPayload(form);
assert.equal(payload.p_modules.find(x => x.module_key === 'workouts').settings.rounding, 5);
assert.deepEqual(Object.keys(payload.p_modules.find(x => x.module_key === 'habits').settings), []);

// Auth routing must honor an invited facility even while its membership is pending.
const storage = new Map([['ripcity:selected-facility-id', 'invited']]);
const authContext = vm.createContext({ window: { sessionStorage: { getItem: key => storage.get(key) } } });
const start = auth.indexOf('function chooseAuthMembership(');
vm.runInContext(auth.slice(start, auth.indexOf('async function redirectByProfile', start)), authContext);
const memberships = [{ facility_id: 'original', status: 'approved' }, { facility_id: 'invited', status: 'pending' }];
assert.equal(authContext.chooseAuthMembership(memberships).facility_id, 'invited');
memberships[1].status = 'approved';
assert.equal(authContext.chooseAuthMembership(memberships).facility_id, 'invited');

// Browser Monday, facility Sunday: the dashboard must use the facility's week.
const dateContext = vm.createContext({ window: { RipCityAccess: { getFacilityDateKey: () => '2026-11-15' } }, Date });
const weekStart = dashboard.indexOf('function getTodayString()');
const weekEnd = dashboard.indexOf('function getStartOfWeekString()');
vm.runInContext(dashboard.slice(weekStart, weekEnd), dateContext);
const week = dateContext.getStartOfWeekDate();
assert.equal(week.getDate(), 9);
assert.equal(week.getMonth(), 10);

// Exercise the actual sign-out wrapper and verify revoke precedes logout.
const events = [];
const clientContext = vm.createContext({ window: {
  location: { hostname: 'localhost' },
  sessionStorage: { removeItem() {} },
  supabase: { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: {} } }), signOut: async () => events.push('signout') },
    rpc: async name => { events.push(name); return { error: null }; }
  }) }
} });
vm.runInContext(await read('js/shared/supabaseClient.js'), clientContext);
await clientContext.window.db.auth.signOut();
assert.deepEqual(events, ['exit_platform_facility_admin', 'signout']);

assert.match(approval, /RipCityUI\.text\(groupLabel\)/);
assert.match(auth, /membership\?\.status === "approved" && !facilityUnavailable/);
assert.match(training, /id="training-calendar-panel" data-facility-module="workouts"/);
assert.match(training, /id="member-testing-schedule-panel" data-facility-module="testing_days"/);
assert.match(member, /selectedWorkoutDate = selectedHabitDate/);
assert.match(migration, /drop policy if exists "facility_members users can insert own pending member row"/);
assert.match(migration, /grant execute on function app_private\.is_platform_owner\(\) to authenticated/);
assert.match(migration, /facility.admin_mode_exited/);
assert.match(migration, /previous_membership->>'role'/);
assert.match(migration, /after insert or update of enabled on public.facility_modules/);
console.log('Facility review runtime and migration contract checks passed');

assert.match(migration, /alter table app_private\.platform_support_memberships enable row level security/);

// A platform owner can reach onboarding even without a facility membership.
const ownerRoutingSource = auth.slice(auth.indexOf('async function routePlatformOwnerWithoutFacility('), auth.indexOf('async function redirectByProfile'));
const destinations = [];
let ownerResult = true;
let ownerQueries = 0;
const ownerContext = vm.createContext({
  window: { location: { replace: url => destinations.push(url) } },
  withAuthTimeout: async request => request,
  db: { rpc: async () => { ownerQueries++; return { data: ownerResult, error: null }; } }
});
vm.runInContext(ownerRoutingSource, ownerContext);
assert.equal(await ownerContext.routePlatformOwnerWithoutFacility(null), true);
assert.deepEqual(destinations, ['platform.html']);
ownerResult = false;
assert.equal(await ownerContext.routePlatformOwnerWithoutFacility({ status: 'pending' }), false);
assert.equal(destinations.length, 1, 'ordinary pending accounts do not enter Platform');
const queriesBeforeApproved = ownerQueries;
assert.equal(await ownerContext.routePlatformOwnerWithoutFacility({ status: 'approved' }), false);
assert.equal(ownerQueries, queriesBeforeApproved, 'approved facility access keeps its normal routing');
const inviteHardening = await read('supabase/migrations/20261117133000_require_active_facility_for_staff_invites.sql');
assert.equal((inviteHardening.match(/facility\.status = 'active'/g) || []).length, 2);
assert.equal((inviteHardening.match(/for share;/g) || []).length, 2);
for (const functionBody of inviteHardening.split('create or replace function public.').slice(1)) {
  assert.ok(functionBody.indexOf('for share;') < functionBody.indexOf('insert into public.facility_members'));
}
