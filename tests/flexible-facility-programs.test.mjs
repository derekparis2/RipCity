import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const platform=await readFile('js/platform/platform.js','utf8');
const element={classList:{add(){},remove(){}},addEventListener(){}};
const values=new Map([['name','Example'],['ui_theme','slate'],['program_recovery_display','Recovery'],['program_recovery_plural','Recovery Members'],['program_recovery_profile_type','general']]);
const ctx=vm.createContext({document:{getElementById:()=>element},window:{},structuredClone,
 FormData:class{get(key){return values.get(key)||'';}}});
vm.runInContext(platform.slice(0,platform.indexOf('  document.getElementById("open-create-facility-btn")'))+'window.readPayload=readPayload;})();',ctx);
const keys=['athlete','h2k','recovery'];
const modules=['workouts','habits','goals','leaderboards','announcements','testing_days'];
const form={facilityProgramKeys:keys,facilityModuleSettings:{},elements:{content_show_feedback:{checked:false},content_show_scores:{checked:true}}};
for(const key of modules) form.elements[`module_${key}`]={checked:true};
for(const key of keys){form.elements[`program_${key}_enabled`]={checked:true};for(const module of modules)form.elements[`program_${key}_module_${module}`]={checked:module!=='testing_days'};}
const payload=ctx.window.readPayload(form);
assert.equal(payload.p_programs.length,3);
assert.equal(payload.p_programs[2].display_name,'Recovery');
assert.equal(payload.p_programs[2].profile_type,'general');
assert.equal(payload.p_programs[2].module_overrides.testing_days,false);
assert.equal(payload.p_dashboard_content.show_feedback,false);

// Exercise facility-code resolution and destination construction without a real service.
const handlers={};
const button={disabled:false};
const input={value:'AB-123',addEventListener(type,handler){handlers['input:'+type]=handler;}};
const next={hidden:true};const message={classList:{add(){},remove(){}}};
const fields={'registration-code-form':{addEventListener(type,handler){handlers[type]=handler;},querySelector:()=>button},'registration-code':input,'registration-continue':next,'registration-code-message':message};
let receivedCode;
const registerCtx=vm.createContext({document:{getElementById:id=>fields[id]},encodeURIComponent,
 db:{rpc:async(name,args)=>{assert.equal(name,'lookup_registration_facility');receivedCode=args.p_code;return{data:{facility_name:'Example Facility'},error:null};}}});
vm.runInContext(await readFile('js/auth/register.js','utf8'),registerCtx);
await handlers.submit({preventDefault(){}});
assert.equal(receivedCode,'AB123');
assert.equal(next.href,'signup.html?code=AB123');
assert.equal(next.hidden,false);
handlers['input:input']();assert.equal(next.hidden,true,'editing the code invalidates the old destination');

const sql=await readFile('supabase/migrations/20261118120000_add_flexible_facility_programs_and_registration.sql','utf8');
assert.match(sql,/foreign key\(facility_id,program_key\) references public\.facility_programs/);
assert.match(sql,/fm\.program_key = requester_program_key/);
assert.match(sql,/program_key = null/,'support entry does not retain a member program on a staff grant');
assert.match(sql,/program_key = support_row.previous_membership->>'program_key'/,'support exit restores the member program');
assert.match(sql,/p_registration_code text/,'code is revalidated on signup submission');
console.log('Flexible facility programs and code-registration checks passed');
