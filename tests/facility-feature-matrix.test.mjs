import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const accessSource = await readFile('js/shared/access-control.js','utf8');
const context = vm.createContext({window:{}});
vm.runInContext(accessSource,context);
const effective = context.window.RipCityAccess.getEffectiveFacilityConfiguration;
const keys = ['workouts','habits','goals','leaderboards','announcements','testing_days'];
let checked = 0;
// Check every facility switch combination against every program combination.
for (let facilityMask = 0; facilityMask < 64; facilityMask++) {
  for (let memberMask = 0; memberMask < 64; memberMask++) {
    const modules = Object.fromEntries(keys.map((key,index)=>[key,{enabled:Boolean(facilityMask & (1<<index)),settings:{retained:true}}]));
    const overrides = Object.fromEntries(keys.map((key,index)=>[key,Boolean(memberMask & (1<<index))]));
    const original = { modules, programs:{athlete:{module_overrides:overrides},h2k:{module_overrides:overrides}} };
    for (const role of ['athlete','h2k_member']) {
      const result = effective(original,{role});
      keys.forEach((key,index)=>{
        assert.equal(result.modules[key].enabled, Boolean((facilityMask & memberMask) & (1<<index)));
        assert.equal(result.modules[key].settings.retained,true);
      });
      checked++;
    }
    assert.equal(effective(original,{role:'admin'}),original,'staff follows facility switches');
    assert.equal(effective(original,{role:'coach'}),original);
    assert.equal(JSON.stringify(original.modules),JSON.stringify(modules),'configuration is not mutated');
  }
}
const config = { modules:{workouts:{enabled:true},testing_days:{enabled:false}}, programs:{athlete:{}} };
assert.equal(effective(config,{role:'athlete'}).modules.workouts.enabled,true,'missing overrides inherit facility settings');
const sql = await readFile('supabase/migrations/20261117200000_add_facility_themes_and_program_features.sql','utf8');
assert.match(sql,/ui_theme in \('midnight', 'slate', 'forest'\)/);
assert.match(sql,/jsonb_typeof\(entry.value\) <> 'boolean'/);
assert.match(sql,/not app_private\.is_facility_admin\(p_facility_id\)/);
assert.match(sql,/create or replace function public\.create_facility_admin_invite/);
const login = await readFile('login.html','utf8');
assert.doesNotMatch(login,/rip-city-logo|RIP CITY|id="login-signup-link"/);
assert.match(login,/Ask your facility for a registration link/);
const shell = await readFile('js/shared/facility-shell.js','utf8');
assert.match(shell,/facilityState = "loading"/);
console.log(`Facility and member program feature matrix: ${checked} combinations passed`);

// Exercise the actual access gate, not just the feature intersection helper.
async function checkRoute(page, role, facilityEnabled, programEnabled, disabledProgram = false) {
  const redirects = [];
  const programKey = role === 'athlete' ? 'athlete' : 'h2k';
  const stored = {id:'facility',name:'Test Facility',slug:'test',status:'active',modules:keys.map(module_key=>({module_key,enabled:facilityEnabled})),programs:[{program_key:programKey,enabled:!disabledProgram,module_overrides:Object.fromEntries(keys.map(key=>[key,programEnabled]))}]};
  const ctx = vm.createContext({
    CustomEvent: class {},
    document:{title:'Facility QA',documentElement:{dataset:{},style:{setProperty(){}}},querySelectorAll:()=>[]},
    window:{location:{pathname:'/'+page,replace:url=>redirects.push(url)},sessionStorage:{getItem:()=>null,removeItem(){}},setTimeout,clearTimeout,dispatchEvent(){}},
    db:{auth:{getSession:async()=>({data:{session:{user:{id:'user'}}},error:null})},
      rpc:async name=>({data:name==='get_current_legal_acceptance'?[{accepted:true}]:name==='get_facility_configuration'?stored:false,error:null}),
      from:()=>({select(){return this;},eq(){return this;},limit:async()=>({data:[{id:'user',facility_members:[{id:'membership',facility_id:'facility',role,status:'approved'}]}],error:null})})}
  });
  vm.runInContext(accessSource,ctx);
  const access = await ctx.window.RipCityAccess.requireMemberAccess();
  return {access,redirects};
}
for (const page of ['member-habits.html','member-goals.html','member-leaderboards.html','member-training.html','workout-session.html','member-habits','member-goals','member-leaderboards','member-training','workout-session']) {
  for (const role of ['athlete','h2k_member']) {
    for (const [facilityOn,programOn] of [[false,true],[true,false],[true,true]]) {
      const result = await checkRoute(page,role,facilityOn,programOn);
      assert.equal(Boolean(result.access),facilityOn && programOn,`${page}: ${role}, facility=${facilityOn}, program=${programOn}`);
      if (!result.access) assert.deepEqual(result.redirects,['member-dashboard.html']);
    }
  }
}
const disabledProgramRoute = await checkRoute('member-dashboard.html','athlete',true,true,true);
assert.deepEqual(disabledProgramRoute.redirects,['pending.html']);
console.log('Direct-page feature gates passed for both member programs');

// Early logging remains available, and completed future sessions are not called Scheduled.
const memberDashboard = await readFile('js/member/member-dashboard.js','utf8');
const statusContext = vm.createContext({});
const statusStart = memberDashboard.indexOf('function getWorkoutCalendarStatus(');
vm.runInContext(memberDashboard.slice(statusStart,memberDashboard.indexOf('function formatCalendarAriaLabel',statusStart)),statusContext);
assert.equal(statusContext.getWorkoutCalendarStatus({isComplete:true,completedSets:2},true,false),'Complete');
assert.equal(statusContext.getWorkoutCalendarStatus({isComplete:false,completedSets:1},true,false),'In Progress');
assert.equal(statusContext.getWorkoutCalendarStatus({isComplete:false,completedSets:0},true,false),'Scheduled');
assert.doesNotMatch(memberDashboard,/const actionLabel = isFuture \? "Preview"/);
