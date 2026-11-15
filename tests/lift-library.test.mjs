import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { filterExercises } from '../js/lift-library.js';
const rows = JSON.parse(await readFile(new URL('../js/exercise-data.json',import.meta.url)));
assert.equal(rows.length,28);
assert.equal(new Set(rows.map(e=>e.id)).size,rows.length);
for (const e of rows) {
  assert.ok(e.instructions.length);
  assert.ok(['barbell','dumbbell','machine','cable','bodyweight'].includes(e.equipment));
  assert.equal(e.images.length,2);
  for (const img of e.images) { assert.match(img,/^icons\/exercises\/[A-Za-z0-9_-]+\.jpg$/); assert.ok((await stat(new URL('../'+img,import.meta.url))).size > 1000); }
}
assert.ok(filterExercises(rows,'  BENCH press ','barbell').length);
assert.ok(filterExercises(rows,'quadriceps').length);
assert.equal(filterExercises(rows,'nonexistent exercise').length,0);
assert.ok(filterExercises(rows,'','bodyweight').every(e=>e.equipment==='bodyweight'));
console.log('ok  library filtering, unique identities, equipment and all 56 local photos');
