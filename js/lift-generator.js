import {restSuggestion} from './lift-rest.js';
// Deterministic heuristics, not medical clearance. See LIFT_PROGRAMMING.md.
import { catalogExercise, equipmentName } from './lift-catalog.js';
export const MUSCLES=['chest','middle back','lats','shoulders','biceps','triceps','forearms','quadriceps','hamstrings','glutes','calves','abdominals'];
export const FOCUS_RULES={'upper chest':/incline/i,'front delts':/front.*rais|shoulder.*press|military.*press/i,'side delts':/lateral.*rais|side.*rais/i,'rear delts':/rear.*delt|reverse.*fly|reverse.*pec/i};
export const DEFAULT_RULES={ beginner:6,intermediate:9,advanced:12,highMultiplier:1.25,maintenance:3,indirect:.5,maxWeekly:14,maxSession:7 };
const focusMatches=(e,key)=>FOCUS_RULES[key]?.test(e.name)&&(key==='upper chest'?e.primaryMuscles.includes('chest'):e.primaryMuscles.includes('shoulders'));
export function eligibleExercise(e,p={}) {
  const text=`${e.name} ${e.instructions.join(' ')} ${e.primaryMuscles.join(' ')} ${e.secondaryMuscles.join(' ')}`.toLowerCase();
  return e.category==='strength' && (!p.equipment||p.equipment.includes(equipmentName(e))) && !(p.excluded??[]).includes(e.id)
    && (!p.experience||p.experience==='advanced'||p.experience==='intermediate'&&e.level!=='expert'||e.level==='beginner')
    && !(p.restrictions??[]).some(t=>String(t).trim()&&text.includes(String(t).trim().toLowerCase()))
    && ![...e.primaryMuscles,...e.secondaryMuscles].some(m=>p.priorities?.[m]==='excluded')
    && !Object.entries(p.focus_priorities??{}).some(([key,value])=>value==='excluded'&&focusMatches(e,key));
}
export function durationEstimate(exercises,{warmup=5,transition=60,secondsPerRep=3}={}) {
  return Math.ceil(warmup+exercises.reduce((total,e)=>total+e.sets*((e.rep_min+e.rep_max)/2*secondsPerRep+(e.rest_seconds??120))/60+transition/60,0));
}
export function muscleWork(exercises, indirect=.5) {
  const out={};
  for(const e of exercises){ for(const m of e.details?.primaryMuscles??[]){out[m]??={direct:0,indirect:0};out[m].direct+=e.sets;}for(const m of e.details?.secondaryMuscles??[]){if(e.details?.primaryMuscles?.includes(m))continue;out[m]??={direct:0,indirect:0};out[m].indirect+=e.sets*indirect;} }
  return out;
}
export function generateProgram(input,catalog,uuid=()=>crypto.randomUUID()) {
  const p={goal:'hypertrophy',experience:'beginner',days:3,minutes:60,equipment:['bodyweight'],favorites:[],excluded:[],restrictions:[],priorities:{},split:'auto',intensity:'moderate',supersets:false,schedule:[],units:'lb',...input};
  if(!['hypertrophy','strength','mixed','fitness','endurance','recomposition'].includes(p.goal)||!['beginner','intermediate','advanced'].includes(p.experience)||!Number.isInteger(p.days)||p.days<2||p.days>7||!Number.isFinite(p.minutes)||p.minutes<20||p.minutes>120)throw new Error('Choose 2–7 days, 20–120 minutes, and a valid goal and experience.');
  if(p.schedule.length && (p.schedule.length!==p.days||new Set(p.schedule).size!==p.days||p.schedule.some(x=>!Number.isInteger(x)||x<0||x>6)))throw new Error('Choose one distinct weekday per training day.');
  if(p.rep_min!=null && (!Number.isInteger(p.rep_min)||!Number.isInteger(p.rep_max)||p.rep_min<1||p.rep_max<p.rep_min||p.rep_max>50))throw new Error('Check preferred rep range (1–50).');
  if(p.warmup!=null&&(!Number.isFinite(p.warmup)||p.warmup<3||p.warmup>20))throw new Error('Warm-up allowance must be 3–20 minutes.');
  const rules={...DEFAULT_RULES,...p.rules};
  if(!Object.values(rules).every(v=>Number.isFinite(v)&&v>=0)||!['beginner','intermediate','advanced','maintenance','maxWeekly','maxSession'].every(k=>Number.isInteger(rules[k]))||rules.maxWeekly>20||rules.maxSession>10||rules.indirect>1||rules.highMultiplier>2)throw new Error('Programming limits are outside conservative bounds; set counts must be whole numbers.');
  const restrictions=p.restrictions.map(x=>String(x).trim().toLowerCase()).filter(Boolean);
  const focus=p.focus_priorities??{};
  const candidates=catalog.filter(e=>eligibleExercise(e,p));
  let split=p.split==='auto'?(p.days<=3?'full':p.days===4?'upper-lower':p.days===5?'hybrid':'ppl'):p.split;
  if(!['full','upper-lower','lower-upper','ppl','hybrid'].includes(split))throw new Error('Unsupported split preference.');
  const lower=['quadriceps','hamstrings','glutes','calves','abductors','adductors'];
  const upper=MUSCLES.filter(m=>!lower.includes(m)),ppl=[['chest','shoulders','triceps'],['middle back','lats','biceps','forearms'],lower.concat('abdominals')];
  const groups=split==='full'?[MUSCLES]:split==='upper-lower'?[upper,lower]:split==='lower-upper'?[lower,upper]:split==='hybrid'?[...ppl,upper,lower]:ppl;
  const labels=split==='full'?['Full body']:split==='upper-lower'?['Upper','Lower']:split==='lower-upper'?['Lower','Upper']:split==='hybrid'?['Push','Pull','Legs','Upper','Lower']:['Push','Pull','Legs'];
  const targets=Object.fromEntries(MUSCLES.map(m=>[m,p.priorities[m]==='excluded'?0:p.priorities[m]==='maintenance'?rules.maintenance:Math.min(rules.maxWeekly,Math.round(rules[p.experience]*(p.priorities[m]==='high'?rules.highMultiplier:1)))]));
  const direct={}; const used=new Map(); const days=[]; const warnings=[];
  for(let i=0;i<p.days;i++) {
    const wanted=groups[i%groups.length]; const exercises=[]; const picked=new Set();
    // Reserve direct work for later exposures instead of spending a week's target on day one.
    const budget=Object.fromEntries(wanted.map(m=>{
      const exposures=Array.from({length:p.days-i},(_,j)=>groups[(i+j)%groups.length]).filter(g=>g.includes(m)).length;
      return [m,Math.ceil(Math.max(0,(targets[m]??0)-(direct[m]??0))/exposures)];
    }));
    const today={};
    for(let slot=0;slot<rules.maxSession;slot++) {
      const rank=candidates.filter(e=>!picked.has(e.id)&&e.primaryMuscles.some(m=>wanted.includes(m))&&e.primaryMuscles.every(m=>(today[m]??0)<(budget[m]??0))).map(e=>{
        const deficit=e.primaryMuscles.reduce((n,m)=>n+Math.max(0,(targets[m]??0)-(direct[m]??0))*(p.priorities[m]==='high'?2:1),0);
        const redundant=exercises.some(x=>x.details.primaryMuscles.join('|')===e.primaryMuscles.join('|')&&x.equipment===equipmentName(e));
        const focusScore=Object.entries(focus).reduce((n,[key,value])=>n+(focusMatches(e,key)?value==='high'?5:value==='maintenance'?-2:0:0),0);
        return {e,score:deficit+focusScore+(p.favorites.includes(e.id)?6:0)+(e.mechanic==='compound'?2:0)-(used.get(e.id)??0)*2-(redundant?20:0)};
      }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.e.id.localeCompare(b.e.id));
      let selected;
      for(const {e,score} of rank) {
        const next=catalogExercise(e,p.units,uuid);
        next.sets=Math.min(p.experience==='beginner'?2:3,...e.primaryMuscles.map(m=>Math.max(0,(budget[m]??0)-(today[m]??0))));
        if(next.sets<1)continue;
        const reps=p.goal==='strength'?[4,6]:p.goal==='endurance'?[15,20]:[8,12];
        [next.rep_min,next.rep_max]=[p.rep_min??reps[0],p.rep_max??reps[1]];
        next.target_rir=p.intensity==='easy'?4:p.intensity==='hard'?2:3;
        next.details.rest_policy='auto';next.rest_seconds=null;const baseRest=restSuggestion(next,{default_rest_seconds:120,details:{preferences:p}}).seconds;next.rest_seconds=baseRest; // Preview stores an explicit, editable base; opting into Auto remains a user choice.
        next.details.target_assumptions=`Editable generated targets: ${next.sets} sets, ${next.rep_min}–${next.rep_max} reps, ${next.target_rir} RIR; ${p.warmup??5} minutes allowed for warm-up. No starting load assumed.`;
        const projected=muscleWork([...days.flatMap(d=>d.exercises),...exercises,next],rules.indirect);
        if(Object.values(projected).some(v=>v.direct+v.indirect>rules.maxWeekly))continue;
        next.notes=`Selected for ${e.primaryMuscles.join(', ')}; ${p.favorites.includes(e.id)?'favorite; ':''}${Object.entries(focus).some(([key,value])=>value==='high'&&focusMatches(e,key))?'named-movement focus preference; ':''}priority/remaining-set score ${score.toFixed(1)}. Editable prescription.`;
        if(durationEstimate([...exercises,next],{warmup:p.warmup??5})>p.minutes)continue;
        selected=next;break;
      }
      if(!selected)break;
      exercises.push(selected);picked.add(selected.details.catalog_id);used.set(selected.details.catalog_id,(used.get(selected.details.catalog_id)??0)+1);
      for(const m of selected.details.primaryMuscles){direct[m]=(direct[m]??0)+selected.sets;today[m]=(today[m]??0)+selected.sets;}
    }
    if(p.supersets)for(let j=0;j+1<exercises.length;j+=2){const a=exercises[j],b=exercises[j+1];if(a.sets===b.sets&&![...a.details.primaryMuscles,...a.details.secondaryMuscles].some(m=>[...b.details.primaryMuscles,...b.details.secondaryMuscles].includes(m))){a.details.superset_group=b.details.superset_group=`pair-${i}-${j}`;}}
    const minutes=durationEstimate(exercises,{warmup:p.warmup??5});
    if(!exercises.length)warnings.push(`Day ${i+1}: no suitable exercises fit the constraints.`);
    days.push({id:uuid(),name:`${labels[i%labels.length]} ${i+1}`,exercises,weekday:p.schedule[i]??null,minutes});
  }
  const work=muscleWork(days.flatMap(d=>d.exercises),rules.indirect);
  for(const m of MUSCLES)if(targets[m]>0&&(work[m]?.direct??0)<targets[m])warnings.push(`${m}: ${work[m]?.direct??0}/${targets[m]} direct target sets; time, equipment or restrictions limited selection.`);
  for(const [m,v] of Object.entries(work))if(v.direct+v.indirect>rules.maxWeekly)warnings.push(`${m}: estimated combined work ${v.direct+v.indirect} exceeds the ${rules.maxWeekly}-set planning cap. Reduce sets before saving.`);
  if(p.days>=5&&p.experience==='beginner')warnings.push('High weekly frequency for a beginner. Consider fewer days and verify recovery.');
  for(const favorite of p.favorites)if(!candidates.some(e=>e.id===favorite))warnings.push(`Favorite ${favorite} was ineligible or unavailable under the selected equipment, level or restrictions.`);
  for(const term of restrictions)if(!catalog.some(e=>`${e.name} ${e.instructions.join(' ')} ${e.primaryMuscles.join(' ')} ${e.secondaryMuscles.join(' ')}`.toLowerCase().includes(term)))warnings.push(`Restriction “${term}” matched no catalog text. It did not exclude movements; explicitly exclude exercises or muscle groups and review suitability.`);
  if(restrictions.length)warnings.push('Restrictions use conservative text filtering, not medical clearance. Review each exercise and its instructions.');
  if(Object.keys(focus).length)warnings.push('Fine muscle preferences rank explicit movement-name patterns. They are not separate anatomical stimulus measurements; shoulder/chest volume still shares the overall cap. Exclusions do not establish medical suitability.');
  if(Object.keys(p.priorities).some(m=>!MUSCLES.includes(m)))warnings.push('Catalog shoulder/back labels are broad. Fine-grained deltoid priorities require manual selection; no precise stimulus model is claimed.');
  warnings.push(...programReview(days,p,catalog).warnings);
  return {days,preferences:p,targets,work,split,warnings,explanation:`${p.split==='auto'?`Recommended ${split} for ${p.days} training days to distribute repeated muscle exposures`:`Requested ${split} split`}. Deterministic selection from ${candidates.length} eligible catalog exercises. Weekly direct-set targets are shared across remaining sessions. ${p.warmup??5}-minute warm-up, 3s/rep, full rest after each set and 60s transitions included. Supersets do not reduce this conservative time estimate. Indirect sets use a configurable ${rules.indirect} multiplier, not measured stimulus.`};
}

export function replacementCandidates(exercise,catalog,preferences={}) {
  const muscles=exercise.details?.primaryMuscles??[];
  if(!muscles.length)return [];
  const allowed=preferences.equipment??[exercise.equipment];
  return catalog.filter(e=>e.id!==exercise.details?.catalog_id&&eligibleExercise(e,{...preferences,equipment:allowed})&&e.primaryMuscles.some(m=>muscles.includes(m))).map(e=>({exercise:e,reason:`Same primary-muscle metadata: ${e.primaryMuscles.filter(m=>muscles.includes(m)).join(', ')}. Review equipment and instructions.`,score:e.primaryMuscles.filter(m=>muscles.includes(m)).length*2+(equipmentName(e)===exercise.equipment?1:0)+((preferences.favorites??[]).includes(e.id)?3:0)})).sort((a,b)=>b.score-a.score||a.exercise.id.localeCompare(b.exercise.id)).slice(0,5);
}

// Re-run after editable-preview changes, not just at generation time.
export function programReview(days,p,catalog) {
  const errors=[],warnings=[],rules={...DEFAULT_RULES,...p.rules},byId=new Map(catalog.map(e=>[e.id,e]));
  const work=muscleWork(days.flatMap(d=>d.exercises),rules.indirect);
  for(const [m,v] of Object.entries(work))if(v.direct+v.indirect>rules.maxWeekly)errors.push(`${m}: ${v.direct+v.indirect} combined set equivalents exceeds your ${rules.maxWeekly}-set cap.`);
  for(const d of days){
    if(!d.exercises.length)errors.push(`${d.name}: add an eligible exercise or change the generation constraints.`);
    if(durationEstimate(d.exercises,{warmup:p.warmup??5})>p.minutes)errors.push(`${d.name}: exceeds your ${p.minutes}-minute budget.`);
    for(const e of d.exercises){const row=byId.get(e.details?.catalog_id);if(!row||!eligibleExercise(row,p))errors.push(`${e.name}: does not meet the selected equipment, experience or exclusions. Change your preferences and regenerate to use it.`);}
  }
  // Respect the selected days, but expose adjacent-day overlap including the week boundary.
  const schedule=p.schedule??[];
  if(schedule.length===days.length){
    for(let i=0;i<days.length;i++){
      const j=schedule.indexOf((schedule[i]+1)%7);if(j<0)continue;
      const a=new Set(days[i].exercises.flatMap(e=>e.details?.primaryMuscles??[]));
      const shared=[...new Set(days[j].exercises.flatMap(e=>e.details?.primaryMuscles??[]))].filter(m=>a.has(m));
      if(shared.length)warnings.push(`${days[i].name} and ${days[j].name} train ${shared.join(', ')} on consecutive selected weekdays. Consider an intervening rest day or a different split; recovery is not measured.`);
    }
  }else warnings.push('Flexible rotation: place rest days between repeated muscle sessions. No weekday schedule or recovery readiness is assumed.');
  return {errors,warnings,work};
}
