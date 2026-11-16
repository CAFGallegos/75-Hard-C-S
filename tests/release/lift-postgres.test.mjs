// DISPOSABLE LOCAL DATABASE ONLY. Fixed loopback port 55439; resets only that disposable schema.
const {default:pg}=await import((process.env.LIFT_RELEASE_TOOLS??'/tmp/lift-release-tools')+'/node_modules/pg/lib/index.js');import fs from 'node:fs';import assert from 'node:assert/strict';
import {startingRoutine} from '../../js/lift-routine.js';
import {validateLiftPlan,validateBackup} from '../../supabase/functions/_shared/lift-schema.js';
const db=new pg.Client({host:'127.0.0.1',port:55439,user:'postgres',password:'local-disposable-only',database:'postgres'});await db.connect();
const q=(s,p)=>db.query(s,p);const rpc=async(name,values)=>{const r=await q(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) result`,values);return r.rows[0].result;};
try{
assert.equal((await q("select current_setting('data_directory') path")).rows[0].path,'/tmp/lift-release-pg','Refuse to reset any other database cluster');
await q('drop schema public cascade;create schema public;grant usage on schema public to public');
await q(`do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role bypassrls;end if;end$$;create table public.people(id text primary key);insert into public.people values('los'),('sue');`);
for(const file of ['supabase/migrations/20261116081556_lift_tracker.sql','supabase/migrations/20261116081605_lift_platform.sql']){await q(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8'));console.log('PASS apply',file);}
const p=validateLiftPlan(startingRoutine({units:'lb',plates:[45,5],bar_weight:45,default_rest_seconds:120,version:0}));await rpc('save_lift_plan',['los',p]);
const state=await rpc('get_lift_state',['los']);assert.equal(state.days.length,5);assert.equal((await rpc('get_lift_state',['sue'])).days.length,0);
await assert.rejects(rpc('save_lift_plan',['sue',{...p,version:0}]),/lift_not_owned/);await assert.rejects(rpc('save_lift_plan',['los',p]),/lift_conflict/);
const e=state.days[0].exercises[0],sid=crypto.randomUUID();const session={id:sid,lift_day_id:state.days[0].id,day:'2026-11-16',day_name:'Test',units:'lb',started_at:'2026-11-16T06:00:00Z',finished_at:'2026-11-16T07:00:00Z',notes:'Disposable',sets:[{exercise_id:e.id,exercise_name:e.name,set_no:1,is_warmup:false,weight:100,reps:8,rir:1.5,exercise_notes:'',details:{rir_qualifier:'exact'}}],details:{}};
await rpc('save_lift_session',['los',session]);await rpc('save_lift_session',['los',session]);assert.equal((await q('select count(*)::int n from lift_sessions')).rows[0].n,1);
await assert.rejects(rpc('save_lift_session',['sue',session]),/lift_not_owned/);
let backup=await rpc('export_lift_backup',['los']);await rpc('restore_lift_backup',['los',validateBackup(backup,'los'),'merge',backup.plan.version,backup.revision]);
backup=await rpc('export_lift_backup',['los']);const bad=structuredClone(backup);bad.sessions[0].sets[0].exercise_id=crypto.randomUUID();bad.sessions[0].sets[0].weight=-1;
await assert.rejects(rpc('restore_lift_backup',['los',bad,'replace',backup.plan.version,backup.revision]));assert.deepEqual((await rpc('export_lift_backup',['los'])).sessions,backup.sessions,'rollback preserves sessions');
await rpc('restore_lift_backup',['los',backup,'replace',backup.plan.version,backup.revision]);
assert.equal((await rpc('get_lift_history',['sue',null,null,null])).length,0);
const beforeRace=await rpc('export_lift_backup',['los']);
const other=new pg.Client({host:'127.0.0.1',port:55439,user:'postgres',password:'local-disposable-only',database:'postgres'});await other.connect();
try{const race={...session,id:crypto.randomUUID()};await Promise.all([rpc('save_lift_session',['los',race]),other.query('select public.save_lift_session($1,$2)',['los',race])]);assert.equal((await q('select count(*)::int n from lift_sessions where id=$1',[race.id])).rows[0].n,1);}finally{await other.end();}
await assert.rejects(rpc('restore_lift_backup',['los',validateBackup(beforeRace,'los'),'replace',beforeRace.plan.version,beforeRace.revision]),/lift_conflict/);
let current=await rpc('get_lift_state',['los']);await rpc('save_lift_plan',['los',{...p,version:current.plan.version,days:[]}]);await rpc('save_lift_session',['los',{...session,id:crypto.randomUUID()}]);assert.equal((await rpc('get_lift_state',['los'])).days.length,0);
assert.equal((await q("select count(*)::int n from pg_class where relname like 'lift_%' and relkind='r' and relrowsecurity")).rows[0].n,5);
console.log('PASS concurrent duplicate save, stale backup revision, archived offline draft and five-table RLS');
await q('set role anon');await assert.rejects(q('select * from lift_sessions'),/permission denied/);await assert.rejects(rpc('get_lift_state',['los']),/permission denied/);await q('reset role');
console.log('PASS ownership/stale plans/atomic rollback/idempotent retries/backup merge-replace/role grants');
}finally{await db.end();}
