import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateProgram,durationEstimate,muscleWork} from '../js/lift-generator.js';
import {validateLiftPlan} from '../supabase/functions/_shared/lift-schema.js';
import {equipmentName} from '../js/lift-catalog.js';
const catalog=JSON.parse(readFileSync(new URL('../js/exercise-catalog.json',import.meta.url)));
const p={goal:'hypertrophy',experience:'intermediate',days:4,minutes:50,equipment:['barbell','dumbbell','bodyweight','cable','machine'],priorities:{chest:'high'},favorites:['Dumbbell_Bench_Press'],schedule:[0,1,3,4],excluded:['Barbell_Bench_Press_-_Medium_Grip'],rules:{maxWeekly:14}};
function run(input=p){let i=1;return generateProgram(input,catalog,()=>`c0000000-0000-4000-8000-${String(i++).padStart(12,'0')}`);}
const result=run();assert.deepEqual(result,run(),'deterministic ranking and prescriptions');assert.equal(result.days.length,4);
for(const d of result.days){assert.ok(d.minutes<=p.minutes);assert.ok(d.exercises.every(e=>p.equipment.includes(e.equipment)));assert.ok(!d.exercises.some(e=>p.excluded.includes(e.details.catalog_id)));assert.equal(new Set(d.exercises.map(e=>e.details.catalog_id)).size,d.exercises.length);}
for(const v of Object.values(result.work))assert.ok(v.direct+v.indirect<=14,'combined volume stays bounded');
validateLiftPlan({units:'lb',bar_weight:45,plates:[45,25,10,5,2.5],default_rest_seconds:120,version:0,days:result.days});
const impossible=run({...p,equipment:[]});assert.ok(impossible.days.every(d=>d.exercises.length===0));assert.ok(impossible.warnings.length);
const restricted=run({...p,restrictions:['press'],priorities:{triceps:'excluded'}});assert.ok(restricted.days.flatMap(d=>d.exercises).every(e=>!e.name.toLowerCase().includes('press')&&!e.details.primaryMuscles.includes('triceps')&&!e.details.secondaryMuscles.includes('triceps')));
assert.throws(()=>run({...p,schedule:[0,0,1,2]}));assert.throws(()=>run({...p,minutes:19}));assert.throws(()=>run({...p,rules:{maxWeekly:100}}));
const e={sets:3,rep_min:10,rep_max:10,rest_seconds:120,details:{primaryMuscles:['chest'],secondaryMuscles:['triceps']}};assert.equal(durationEstimate([e]),14);assert.deepEqual(muscleWork([e]),{chest:{direct:3,indirect:0},triceps:{direct:0,indirect:1.5}});
assert.ok(run({...p,experience:'beginner'}).days.flatMap(d=>d.exercises).every(e=>catalog.find(c=>c.id===e.details.catalog_id).level==='beginner'));
console.log('ok  Generator determinism, full-catalog constraints, restrictions, schedule, volume caps, validated prescriptions and duration estimates');
const namedRestricted=run({...p,focus_priorities:{'side delts':'excluded'}});assert.ok(namedRestricted.days.flatMap(d=>d.exercises).every(e=>!(/lateral.*rais|side.*rais/i.test(e.name)&&e.details.primaryMuscles.includes('shoulders'))));
const noTextMatch=run({...p,restrictions:['unmatched-clinical-label']});assert.ok(noTextMatch.warnings.some(w=>w.includes('matched no catalog text')));

const lowerFirst=run({...p,days:5,schedule:[],split:'lower-upper',priorities:{glutes:'high',quadriceps:'high',hamstrings:'high'}});
assert.equal(lowerFirst.days.filter(d=>d.name.startsWith('Lower')).length,3);
assert.equal(lowerFirst.days.filter(d=>d.name.startsWith('Upper')).length,2);
assert.ok(lowerFirst.days.every(d=>d.minutes<=p.minutes));
assert.ok(Object.values(lowerFirst.work).every(m=>m.direct+m.indirect<=14));
console.log('ok  Lower-first five-session generation preserves three lower/two upper days, time limits and volume caps');

const {eligibleExercise,replacementCandidates,programReview}=await import('../js/lift-generator.js');
for(const days of [5,6,7]){
 const balanced=run({...p,experience:'beginner',days,schedule:[]});
 assert.ok(balanced.days.every(d=>d.exercises.reduce((n,e)=>n+e.sets,0)>=4),'reserve enough direct work for later sessions');
 assert.ok(Object.values(balanced.work).every(v=>v.direct+v.indirect<=14));
 assert.equal(programReview(balanced.days,balanced.preferences,catalog).errors.length,0);
}
assert.equal(run({...p,days:5,schedule:[]}).split,'hybrid');
const source={equipment:'barbell',details:{catalog_id:'Barbell_Bench_Press_-_Medium_Grip',primaryMuscles:['chest']}};
const exclusions={equipment:['dumbbell','barbell'],experience:'intermediate',priorities:{triceps:'excluded'},restrictions:['shoulders']};
assert.ok(replacementCandidates(source,catalog,exclusions).every(x=>eligibleExercise(x.exercise,exclusions)));
assert.equal(eligibleExercise({id:'synthetic',name:'Press',category:'strength',equipment:'barbell',level:'expert',primaryMuscles:['chest'],secondaryMuscles:['triceps'],instructions:[]},{experience:'intermediate'}),false);
assert.equal(eligibleExercise({id:'synthetic',name:'Press',category:'strength',equipment:'barbell',level:'beginner',primaryMuscles:['chest'],secondaryMuscles:['triceps'],instructions:[]},{priorities:{triceps:'excluded'}}),false);
const tooMuch=structuredClone(result.days);tooMuch[0].exercises[0].sets=100;
assert.ok(programReview(tooMuch,result.preferences,catalog).errors.some(e=>e.includes('cap')),'edits cannot bypass weekly caps');
const changedEquipment={...result.preferences,equipment:[]};
assert.ok(programReview(result.days,changedEquipment,catalog).errors.some(e=>e.includes('equipment')));
const repeated=[{name:'A',exercises:[e]},{name:'B',exercises:[e]}];
assert.ok(programReview(repeated,{minutes:60,schedule:[6,0]},[]).warnings.some(w=>w.includes('consecutive')),'Sunday/Monday recovery overlap is visible');
assert.throws(()=>run({...p,rules:{maintenance:2.5}}),/whole numbers/);
assert.match(run({...p,warmup:12}).explanation,/12-minute warm-up/);
console.log('ok  Later-session allocation, five-day hybrid, replacement restrictions, edited-preview limits and adjacent-day recovery warnings');
const paired=run({...p,supersets:true});
for(const day of paired.days){const groups=new Map();for(const e of day.exercises){const id=e.details.superset_group;if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(e);}}for(const members of groups.values()){assert.equal(members.length,2);const [a,b]=members;assert.equal(a.sets,b.sets);assert.ok(![...a.details.primaryMuscles,...a.details.secondaryMuscles].some(m=>[...b.details.primaryMuscles,...b.details.secondaryMuscles].includes(m)));}}
console.log('ok  Generated supersets avoid known primary and secondary muscle overlap');
