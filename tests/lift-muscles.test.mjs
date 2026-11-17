import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {muscleTargets} from '../js/lift-muscles.js';
const rows=JSON.parse(await fs.readFile('js/exercise-catalog.json'));const data=JSON.parse(await fs.readFile('js/muscle-paths.json'));
for(const body of Object.values(data)){assert.ok(body.length>10);for(const part of body)for(const path of Object.values(part.path).flat())assert.match(path,/^M/i);}
const target=muscleTargets([{details:{catalog_id:'Barbell_Bench_Press_-_Medium_Grip'}}],rows);assert.ok(target.primary.includes('chest'));assert.ok(target.secondary.includes('triceps'));assert.ok(!target.secondary.includes('chest'));
assert.equal(muscleTargets([{name:'Unknown'}],rows).unmatched,1);assert.deepEqual(muscleTargets([{name:'Unknown'}],rows).primary,[]);
console.log('ok Licensed body paths, confirmed targets, secondary deduplication and unmapped honesty');
const media=JSON.parse(await fs.readFile('js/lift-media.json'));for(const entry of media){const row=rows.find(r=>r.id===entry.id);assert.ok(row);for(const [i,file] of entry.images.entries()){assert.equal(file,'icons/exercises/'+row.images[i].replace('/','-'));const b=await fs.readFile(file);assert.equal(b[0],255);assert.equal(b[1],216);}}
console.log('ok Additional local photos exactly retain pinned catalog IDs and JPEG files');
