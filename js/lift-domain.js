// Lift-only data semantics. Suggestions and references never become evidence.
import { convertWeight, suggest, clean } from './lift-rules.js';
export const LOAD_TYPES = ['external', 'bodyweight', 'added', 'assisted', 'unknown'];
export const EQUIPMENT = ['barbell','dumbbell','machine','cable','bodyweight','bands','e-z curl bar','exercise ball','foam roll','kettlebells','medicine ball','other','unspecified'];
export function loadType(e) { return e.details?.load_type ?? (e.equipment === 'bodyweight' ? e.logged?.some(s=>s.weight>0)?'unknown':'bodyweight' : 'external'); }
export function rirText(set) { return `${set.rir ?? '—'}${set.details?.rir_qualifier === 'at_least' || set.rir_qualifier === 'at_least' ? '+' : ''}`; }
export function loadLabel(type, units) { return ({ external: units, bodyweight: 'BW (no load)', added: `Added ${units}`, assisted: `Assist ${units}`, unknown: `Load ${units} (unverified)` })[type]; }
export function comparable(set) { return !set.is_warmup && set.completed !== false && (set.details?.load_type ?? 'external') === 'external' && set.details?.rir_qualifier !== 'at_least'; }
export function safeMetrics(sets) {
  const work = sets.filter((s) => !s.is_warmup && s.completed !== false);
  const known = work.filter((s) => (s.details?.load_type ?? 'external') === 'external');
  const estimates = known.filter((s) => s.details?.kind !== 'drop' && s.details?.rir_qualifier !== 'at_least' && s.reps <= 12 && s.rir <= 4 && ['barbell','dumbbell'].includes(s.details?.equipment) && s.details?.mechanic === 'compound');
  return { volume: clean(known.reduce((sum,s) => sum + s.weight * s.reps, 0)), top: known.length ? Math.max(...known.map((s) => s.weight)) : null, e1rm: estimates.length ? clean(Math.max(...estimates.map((s) => s.weight * (1 + (s.reps + s.rir)/30)))) : null, excluded: work.length - known.length, sets: work.length };
}
export function referenceSets(e, units) {
  return (e.details?.references ?? []).map((s) => ({ weight: s.weight == null ? null : convertWeight(s.weight,s.units ?? units,units), reps: s.reps, rir: s.rir, details: { rir_qualifier: s.rir_qualifier ?? 'exact' } }));
}
export function workoutSuggestion(e, history = [], units = 'lb') {
  const type = loadType(e), apparatus = e.details?.apparatus ?? '';
  const confirmed = history.map(h=>({...h,sets:(h.sets??[]).filter(s=>!s.is_warmup&&s.details?.kind!=='drop'&&s.completed!==false&&(s.details?.load_type??'external')===type&&(s.details?.apparatus??'')===apparatus&&(!s.details?.equipment||s.details.equipment===e.equipment))})).filter(h=>h.sets.length);
  if (!confirmed.length) {
    const refs = referenceSets(e,units);
    return { reason: refs.length ? 'Starting reference — editable, not a confirmed session.' : 'No confirmed performance. Enter a load; targets are suggestions.', source: refs.length ? 'reference' : 'target', last: [], sets: Array.from({length:e.sets},(_,i) => refs[i] ?? { weight: type === 'bodyweight' ? 0 : null, reps:e.rep_min, rir:e.target_rir, details:{rir_qualifier:'exact'} }) };
  }
  // Assisted and unknown loads require judgment; a larger assistance number is easier.
  if (type === 'assisted' || type === 'unknown' || confirmed[0].sets.some(s=>s.details?.rir_qualifier==='at_least')) {
    const last=confirmed[0].sets.map(s=>({...s,weight:convertWeight(s.weight,confirmed[0].units??units,units)}));
    return {reason:'Confirmed performance shown. Choose changes manually for assistance, unknown loads or qualified RIR.',source:'confirmed',last,sets:Array.from({length:e.sets},(_,i)=>last[i]??{weight:last.at(-1).weight,reps:e.rep_min,rir:e.target_rir,details:{rir_qualifier:'exact'}})};
  }
  const result = suggest(e, confirmed.map((h) => ({ ...h, sets:h.sets.filter((s) => s.details?.rir_qualifier !== 'at_least') })), units);
  if (type === 'bodyweight') { result.sets.forEach((s,i) => { s.weight = 0; if(result.branch==='increase')s.reps=confirmed[0].sets.filter(x=>!x.is_warmup)[i]?.reps??e.rep_max; }); if(result.branch==='increase')result.reason='Top of the bodyweight rep range: consider a harder variation or explicitly change to added load. No bodyweight is assumed.'; }
  return { ...result, last:confirmed[0].sets.map(s=>({...s,weight:convertWeight(s.weight,confirmed[0].units??units,units)})), source:'confirmed' };
}
export function exerciseDraft(e, state, uuid = () => crypto.randomUUID()) {
  const r = workoutSuggestion(e,state.recent?.[e.id],state.plan.units);
  return { ...structuredClone(e), runtime_id:uuid(), reason:r.reason, last:r.last, source:r.source,
    logged:r.sets.map((s,i) => ({ weight:s.weight == null ? null : Number(s.weight.toFixed(2)), reps:s.reps, rir:s.rir, details:{ ...s.details, rir_qualifier:s.details?.rir_qualifier ?? 'exact', load_type:loadType(e), equipment:e.equipment, apparatus:e.details?.apparatus ?? '', catalog_id:e.details?.catalog_id ?? null, primaryMuscles:e.details?.primaryMuscles ?? [], secondaryMuscles:e.details?.secondaryMuscles ?? [], mechanic:e.details?.mechanic??null, kind:'working' }, set_no:i+1, is_warmup:false, completed:false })) };
}
export function elapsedSeconds(d, now = Date.now()) { return Math.max(0, Math.floor(((d.finished_at ? Date.parse(d.finished_at) : d.paused_at ?? now) - Date.parse(d.started_at))/1000 - (d.pause_seconds ?? 0))); }
export function togglePause(d, now = Date.now()) {
  if (d.paused_at) { d.pause_seconds = (d.pause_seconds ?? 0) + (now-d.paused_at)/1000; if (d.rest_remaining != null) { d.timer_end=now+d.rest_remaining; if(d.rest_was_alerted)d.timer_alerted_end=d.timer_end; } d.paused_at=null; d.rest_remaining=null; d.rest_was_alerted=false; }
  else { d.paused_at=now; d.rest_remaining=d.timer_end == null ? null : d.timer_end-now; d.rest_was_alerted=d.timer_alerted_end===d.timer_end; d.timer_end=null; }
}
export function restEligible(d, ei, si) {
  const e=d.exercises[ei], s=e.logged[si];
  if (!s.completed || s.is_warmup || d.paused_at || d.finished_at) return false;
  if (e.logged[si+1]?.details?.kind === 'drop') return false;
  const group=e.details?.superset_group;
  if (!group) return true;
  const round=e.logged.slice(0,si+1).filter(x=>!x.is_warmup&&x.details?.kind!=='drop').length-1;
  const members=d.exercises.filter((x) => x.details?.superset_group===group);
  return members.every((x) => {
    const primary=x.logged.filter(v=>!v.is_warmup&&v.details?.kind!=='drop')[round];
    // Unequal groups finish together while rounds overlap; extra rounds rest normally.
    if(!primary)return true;
    if(!primary.completed)return false;
    const at=x.logged.indexOf(primary);
    for(let j=at+1;j<x.logged.length&&x.logged[j].details?.kind==='drop';j++)if(!x.logged[j].completed)return false;
    return true;
  });
}
export function adjustment(e, history, fatigue = null, units='lb') {
  const rows=history.map(h=>({...h,sets:(h.sets??[]).filter(s=>!s.is_warmup&&s.details?.kind!=='drop'&&s.completed!==false&&s.details?.rir_qualifier!=='at_least'&&(s.details?.load_type??'external')===loadType(e)&&(s.details?.apparatus??'')===(e.details?.apparatus??'')&&(!s.details?.equipment||s.details.equipment===e.equipment))})).filter(h=>h.sets.length);
  const scores=rows.filter(h=>h.sets.length===e.sets).slice(0,3).map(h=>JSON.stringify(h.sets.map(s=>[convertWeight(s.weight,h.units??units,units),s.reps,s.rir])));
  const tips=[];
  if (fatigue >= 4) tips.push('High reported fatigue: consider one fewer working set or a lighter session. Optional; your plan is unchanged.');
  if (scores.length===3 && scores.every((x) => x===scores[0])) tips.push('Three comparable sessions with unchanged load, reps and RIR: consider recovery, a rep target change, or a replacement.');
  if (rows.length>=2 && rows.slice(0,2).every((h) => h.sets.some((s) => s.reps<e.rep_min))) tips.push('Two sessions below range: consider a load deload or reduced volume.');
  return tips;
}
