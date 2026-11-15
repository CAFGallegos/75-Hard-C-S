export const CATALOG_REVISION='f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const CATALOG_SOURCE=`https://github.com/yuhonas/free-exercise-db/tree/${CATALOG_REVISION}`;
export const MEDIA_BASE=`https://raw.githubusercontent.com/yuhonas/free-exercise-db/${CATALOG_REVISION}/exercises/`;
let loaded;
export function loadCatalog() {
  if (!loaded) loaded=fetch(new URL('./exercise-catalog.json',import.meta.url)).then((r)=>{if(!r.ok)throw new Error('Library unavailable offline. Reopen when connected.');return r.json();}).catch((err)=>{loaded=null;throw err;});
  return loaded;
}
export function equipmentName(e) { return e.equipment==='body only'?'bodyweight':e.equipment??'unspecified'; }
export function exerciseGuidance(e) {
  // Explicit name-derived hints, never upstream metadata or a safety assessment.
  const patterns=[[/squat|leg press|lunge|step.up/i,'Squat / knee-dominant'],[/deadlift|good morning|hip thrust|butt lift|glute bridge/i,'Hinge / hip extension'],[/bench press|push.up|chest press/i,'Horizontal push'],[/shoulder press|military press|pike push/i,'Vertical push'],[/pull.up|chin.up|pulldown/i,'Vertical pull'],[/\brows?\b/i,'Horizontal pull'],[/curl|extension|raise|fly|flye|calf/i,'Accessory / single-joint candidate']];
  const pattern=patterns.find(([re])=>re.test(e.name))?.[1];
  return {pattern:pattern?`${pattern} · inferred from name; confirm technique`:'Movement pattern not classified; review instructions',reps:e.category==='strength'?'Editable starting suggestion: 3 × 8–12 at 2 RIR, matching the library’s plan defaults. Adjust for your goal and experience; no load is assumed.':'No repetition prescription for this catalog category. Set appropriate targets manually.'};
}
const aliases={ delts:'shoulders', 'upper back':'middle back', core:'abdominals', abs:'abdominals', quads:'quadriceps', 'rear delts':'shoulders', 'side delts':'shoulders', 'front delts':'shoulders' };
export function filterCatalog(rows,query='',filters={}) {
  const normalized=query.toLowerCase().trim();
  let expanded=normalized;
  for(const [alias,muscle] of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length))expanded=expanded.replaceAll(alias,muscle);
  const terms=expanded.split(/\s+/).filter(Boolean);
  return rows.filter(e=>(!filters.equipment||equipmentName(e)===filters.equipment)&&(!filters.muscle||e.primaryMuscles.includes(filters.muscle)||e.secondaryMuscles.includes(filters.muscle))&&(!filters.level||e.level===filters.level)&&(!filters.category||e.category===filters.category)&&(!filters.favorites||filters.favorites.includes(e.id))&&terms.every(t=>`${e.name} ${equipmentName(e)} ${(e.aliases??[]).join(' ')} ${e.primaryMuscles.join(' ')} ${e.secondaryMuscles.join(' ')}`.toLowerCase().includes(t)));
}
export function catalogExercise(row, units='lb', uuid=()=>crypto.randomUUID()) {
  const equipment=equipmentName(row);
  return {id:uuid(),name:row.name,equipment,sets:3,rep_min:8,rep_max:12,target_rir:2,increment:units==='lb'?5:2.5,rest_seconds:null,notes:'Editable defaults: 3 × 8–12 @ 2 RIR.',details:{catalog_id:row.id,mechanic:row.mechanic??null,source_revision:row.id.startsWith('custom-')?null:CATALOG_REVISION,source:row.id.startsWith('custom-')?'custom':'free-exercise-db',load_type:equipment==='bodyweight'?'bodyweight':equipment==='unspecified'||equipment==='other'?'unknown':'external',apparatus:row.name,primaryMuscles:[...row.primaryMuscles],secondaryMuscles:[...row.secondaryMuscles],target_assumptions:'3 sets, 8–12 reps and 2 RIR assumed.'}};
}
export function mediaUrl(path) { if(!/^[A-Za-z0-9_()'., -]+\/\d+\.jpg$/.test(path))return null;return MEDIA_BASE+path.split('/').map(encodeURIComponent).join('/'); }
