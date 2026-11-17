import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveIllustration,illustrationUrl,revealCurrentTile} from '../js/lift-visuals.js';
import {ROUTINE,SUE_ROUTINE} from '../js/lift-routine.js';
const catalog=JSON.parse(await readFile(new URL('../js/exercise-catalog.json',import.meta.url),'utf8'));
const exercises=structuredClone(ROUTINE.flatMap(d=>d.exercises));const before=structuredClone(exercises);
for(const e of exercises){const match=resolveIllustration(e,catalog);if(match.kind!=='missing')assert.ok(match.row,`${e.name} alias resolves`);if(match.kind==='approximation')assert.match(match.note,/Illustrative approximation/);}
assert.deepEqual(exercises,before,'resolving images never changes identity, references or loads');
for(const name of ['Lateral Raises, Machine','Pull-Ups, Wide Neutral Grip','One-Arm Rows, Reverse Grip, Dumbbells','Kettle SQ Extension','Reverse Flys','Lean Away Lateral Raises'])assert.equal(resolveIllustration(exercises.find(e=>e.name===name),catalog).kind,'missing',name);
assert.equal(resolveIllustration({name:'Dips',equipment:'machine'},catalog).kind,'missing','equipment mismatch never aliases');
assert.equal(resolveIllustration(exercises[1],catalog).row.id,'Wide-Grip_Barbell_Bench_Press');
assert.equal(resolveIllustration({name:'Dips',equipment:'bodyweight',details:{catalog_id:'nonexistent'}},catalog).row,undefined,'invalid confirmed ID does not silently alias');
for(const day of SUE_ROUTINE)for(const [id] of day.exercises)assert.equal(resolveIllustration({name:'Sue',details:{catalog_id:id}},catalog).row.id,id);
const chosen=resolveIllustration(exercises[3],catalog,'Side_Lateral_Raise');assert.equal(chosen.kind,'chosen');assert.match(chosen.note,/identity unchanged/);
for(const path of ['https://evil.example/image.jpg','../private.jpg','icons/exercises/../../private.jpg','data:image/svg+xml,bad'])assert.equal(illustrationUrl(path),null);
assert.equal(illustrationUrl('icons/exercises/Wide-Grip_Barbell_Bench_Press-0.jpg'),'icons/exercises/Wide-Grip_Barbell_Bench_Press-0.jpg');
assert.match(illustrationUrl('Side_Lateral_Raise/0.jpg'),/^https:\/\/raw.githubusercontent.com\//);
const rail={scrollLeft:0,getBoundingClientRect:()=>({left:10,right:310})};const tile={parentElement:rail,getBoundingClientRect:()=>({left:400,right:488})};revealCurrentTile({querySelector:()=>tile});assert.equal(rail.scrollLeft,180);tile.getBoundingClientRect=()=>({left:-30,right:58});revealCurrentTile({querySelector:()=>tile});assert.equal(rail.scrollLeft,138);
console.log('ok Illustration identity, honest aliases, Sue catalog IDs, safe media paths and strip-only reveal');
