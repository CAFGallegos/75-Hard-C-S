import { validateBackup, validateLiftPlan } from '../supabase/functions/_shared/lift-schema.js';
export function makeBackup(owner,plan,sessions){return validateBackup({format:'75hard-lift',version:1,owner,exported_at:new Date().toISOString(),plan,sessions},owner);}
export function canonicalLift(x){ const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>!['position','person_id','day_id','session_id','archived'].includes(k)).map(k=>[k,clean(v[k])])):v; return JSON.stringify(clean(x)); }
const canonical=canonicalLift;
export function mergeBackups(current,incoming,mode='merge'){
  const old=validateBackup(current,current.owner),next=validateBackup(incoming,current.owner);
  if(!['merge','replace'].includes(mode))throw new Error('Choose merge or replace.');
  if(mode==='replace')return {...next,plan:{...next.plan,version:old.plan.version}};
  const days=structuredClone(old.plan.days),sessions=structuredClone(old.sessions);
  for(const day of next.plan.days){const exists=days.find(d=>d.id===day.id);if(exists){if(canonical(exists)!==canonical(day))throw new Error(`Conflicting plan day: ${day.name}. Use replace after reviewing your backup.`);}else days.push(day);}
  for(const s of next.sessions){const exists=sessions.find(x=>x.id===s.id);if(exists){if(canonical(exists)!==canonical(s))throw new Error('A session UUID has conflicting content. Import stopped; no data changed.');}else sessions.push(s);}
  if(old.plan.units!==next.plan.units&&next.plan.days.some(d=>!old.plan.days.some(x=>x.id===d.id)))throw new Error('Merge requires matching plan units. Convert settings or use replace.');
  const details={...old.plan.details};
  for(const key of ['favorites','imports'])details[key]=[...new Set([...(old.plan.details[key]??[]),...(next.plan.details[key]??[])])];
  for(const key of ['custom','programs']){const entries=[...(old.plan.details[key]??[])];for(const row of next.plan.details[key]??[]){const exists=entries.find(x=>x.id===row.id);if(exists&&canonical(exists)!==canonical(row))throw new Error(`Conflicting ${key} identity.`);if(!exists)entries.push(row);}details[key]=entries;}
  return {...old,plan:validateLiftPlan({...old.plan,days,details}),sessions};
}
