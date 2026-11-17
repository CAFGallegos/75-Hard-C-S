// Loopback-only visual review. Only invented loads are sent to the browser.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startingRoutine} from '../js/lift-routine.js';
import {server,mockCall} from './lift-preview.mjs';
export async function seedVisualPreview() {
  const catalog=JSON.parse(await readFile(new URL('../js/exercise-catalog.json',import.meta.url),'utf8'));
  for(const [key,person] of [['sample-a','los'],['sample-b','sue']]) {
    const state=mockCall({k:key,a:'lift_state'});
    const plan=startingRoutine({...state.plan,details:{...state.plan.details,imports:[]}},()=>crypto.randomUUID(),person,catalog);
    plan.days.forEach(day=>{day.name='Sample '+day.name;day.exercises.forEach(exercise=>{
      exercise.notes='Synthetic preview only. Choose your own load in the real app.';
      exercise.details.references=exercise.details.references.map((reference,i)=>({weight:exercise.details.load_type==='bodyweight'?0:20+i*5,reps:10,rir:i?1.5:5,rir_qualifier:i?'exact':'at_least',units:'lb'}));
    });});
    mockCall({k:key,a:'lift_plan_save',plan});
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  await seedVisualPreview();
  server.listen(4182,'127.0.0.1',()=>console.log('Synthetic Lift review: http://127.0.0.1:4182/?k=sample-a&tab=lift and ?k=sample-b&tab=lift'));
}
