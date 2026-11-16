import { safeMetrics } from './lift-domain.js';
import { convertWeight } from './lift-rules.js';
export function analyticsRange(range,{today,from='',to=''}={}) {
 if(range==='custom'){
  if(from&&to&&from>to)throw new Error('The start date must be on or before the end date.');
  return {from:from||'0000-01-01',to:to||today};
 }
 if(range==='all')return {from:'0000-01-01',to:today};
 const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-Number(range)+1);
 return {from:date.toISOString().slice(0,10),to:today};
}
export function trainingAnalytics(sessions,{from='0000-01-01',to='9999-12-31',units='lb',scheduledDays=null,scheduledDates=null,programId=null}={}) {
 const rows=sessions.filter(s=>s.day>=from&&s.day<=to),weeks={},muscles={},records=new Map();let duration=0,knownDuration=0,volume=0,excluded=0,unmapped=0,completedSets=0,plannedSets=0;const fatigue=[];
 for(const s of [...rows].sort((a,b)=>a.finished_at.localeCompare(b.finished_at))){
  const date=new Date(s.day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const week=date.toISOString().slice(0,10);weeks[week]=(weeks[week]??0)+1;
  const seconds=s.details?.duration_seconds??Math.max(0,(Date.parse(s.finished_at)-Date.parse(s.started_at))/1000-(s.details?.pause_seconds??0));if(Number.isFinite(seconds)){duration+=seconds;knownDuration++;}
  const sets=s.sets.filter(x=>x.completed!==false).map(x=>({...x,weight:convertWeight(x.weight,s.units,units)}));const m=safeMetrics(sets);volume+=m.volume;excluded+=m.excluded;
  if(s.details?.fatigue!=null)fatigue.push({day:s.day,value:s.details.fatigue});
  completedSets+=sets.filter(x=>!x.is_warmup&&x.details?.kind!=='drop').length;plannedSets+=s.details?.planned_sets??0;
  for(const x of sets.filter(x=>!x.is_warmup)){
   if(!x.details?.primaryMuscles?.length)unmapped++;
   for(const muscle of x.details?.primaryMuscles??[]){muscles[muscle]??={direct:0,indirect:0};muscles[muscle].direct++;}
   for(const muscle of x.details?.secondaryMuscles??[]){if(x.details?.primaryMuscles?.includes(muscle))continue;muscles[muscle]??={direct:0,indirect:0};muscles[muscle].indirect+=.5;}
   const type=x.details?.load_type??'external';if(!['external','added','bodyweight'].includes(type)||x.details?.kind==='drop')continue;
   const key=`${x.exercise_id??x.details?.catalog_id??x.exercise_name}|${x.details?.apparatus??''}|${type}`;
   const old=records.get(key);if(!old||x.weight>old.weight||(x.weight===old.weight&&x.reps>old.reps))records.set(key,{name:x.exercise_name,apparatus:x.details?.apparatus??'Unspecified equipment',type,weight:x.weight,reps:x.reps,day:s.day});
  }
 }
 const uniqueDays=new Set(rows.map(s=>s.day)).size;
 // Include zero-workout weeks only within the requested or recorded span.
 const first=from==='0000-01-01'?[...rows].map(s=>s.day).sort()[0]:from;
 const last=to==='9999-12-31'?[...rows].map(s=>s.day).sort().at(-1):to;
 if(first&&last&&first<=last){const date=new Date(first+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);for(let i=0;i<1500&&date.toISOString().slice(0,10)<=last;i++,date.setUTCDate(date.getUTCDate()+7)){weeks[date.toISOString().slice(0,10)]??=0;}}
 const orderedWeeks=Object.fromEntries(Object.entries(weeks).sort(([a],[b])=>a.localeCompare(b)));
 const matchedSchedule=scheduledDates?new Set(rows.filter(s=>(!programId||s.details?.program_id===programId)&&scheduledDates.includes(s.day)).map(s=>s.day)).size:null;
 if(scheduledDates)scheduledDays=scheduledDates.length;
 return {scheduledDays,matchedSchedule,count:rows.length,uniqueDays,weeks:orderedWeeks,activeWeeks:Object.values(orderedWeeks).filter(n=>n>0).length,trackedWeeks:Object.keys(orderedWeeks).length,muscles,volume,excluded,unmapped,durationMinutes:Math.round(duration/60),averageMinutes:knownDuration?Math.round(duration/knownDuration/60):null,records:[...records.values()],fatigue:fatigue.length>=3?fatigue:[],fatigueCount:fatigue.length,plannedSets,completedSets,adherence:scheduledDays>0?Math.min(100,Math.round((matchedSchedule??uniqueDays)/scheduledDays*100)):null};
}

export function plannedDates(start,end,weekdays,from=start){
  if(!start||!Array.isArray(weekdays)||!weekdays.length||start>end)return null;
  const result=[];let day=start>from?start:from;let steps=0;
  while(day<=end&&steps++<10000){const date=new Date(day+'T12:00:00Z');if(weekdays.includes((date.getUTCDay()+6)%7))result.push(day);date.setUTCDate(date.getUTCDate()+1);day=date.toISOString().slice(0,10);}
  return result;
}
export function performanceKey(set){return `${set.exercise_id??set.details?.catalog_id??set.exercise_name}|${set.details?.apparatus??''}|${set.details?.load_type??'external'}`;}
export function exerciseSeries(sessions,units='lb'){
 const groups=new Map();
 for(const s of [...sessions].sort((a,b)=>a.finished_at.localeCompare(b.finished_at))){const byKey=new Map();for(const set of s.sets.filter(x=>x.completed!==false&&!x.is_warmup&&x.details?.kind!=='drop')){const key=performanceKey(set);if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push({...set,weight:convertWeight(set.weight,s.units,units)});}
  for(const [key,sets]of byKey){if(!groups.has(key))groups.set(key,{key,name:sets[0].exercise_name,apparatus:sets[0].details?.apparatus??'Unspecified apparatus',type:sets[0].details?.load_type??'external',points:[]});const group=groups.get(key);group.points.push({day:s.day,weight:group.type==='external'?Math.max(...sets.map(x=>x.weight)):null,reps:Math.max(...sets.map(x=>x.reps)),sets});}
 }
 return [...groups.values()];
}

export function activeWeekStreak(sessions,today){
 const week=day=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
 const active=new Set(sessions.filter(s=>s.day<=today&&s.sets.some(x=>!x.is_warmup&&x.completed!==false)).map(s=>week(s.day)));
 const cursor=new Date(week(today)+'T12:00:00Z');if(!active.has(week(today)))cursor.setUTCDate(cursor.getUTCDate()-7);
 let count=0;while(active.has(cursor.toISOString().slice(0,10))){count++;cursor.setUTCDate(cursor.getUTCDate()-7);}return count;
}
export function catalogUsage(sessions){const counts={};for(const session of sessions){for(const id of new Set(session.sets.filter(s=>!s.is_warmup&&s.completed!==false).map(s=>s.details?.catalog_id).filter(Boolean)))counts[id]=(counts[id]??0)+1;}return counts;}
