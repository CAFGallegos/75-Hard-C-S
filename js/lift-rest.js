export function restSuggestion(e,plan,set){
 if(e.rest_seconds!=null)return {seconds:e.rest_seconds,source:'Custom',reason:'Exercise override (including zero).'};
 const fallback={seconds:plan.default_rest_seconds,source:'Plan default',reason:'Your saved default rest.'};
 if(e.details?.rest_policy!=='auto')return fallback;
 const mechanic=e.details?.mechanic;
 if(!['compound','isolation'].includes(mechanic))return {...fallback,reason:'Movement classification unknown; using plan default.'};
 const base=mechanic==='compound'?(plan.details?.preferences?.goal==='strength'||e.rep_max<=6?180:120):90;
 const extra=set?.completed&&set.rir<=1&&set.details?.rir_qualifier!=='at_least'?30:0;
 return {seconds:Math.min(300,Math.max(60,base+extra)),source:'Suggested',reason:`${mechanic}${base===180?' · strength range':''}${extra?' · +30s for confirmed low RIR':''}. Editable training default.`,policyVersion:1};
}
export function roundRest(d,ei,si){
 const e=d.exercises[ei],group=e.details?.superset_group;
 const members=group?d.exercises.filter(x=>x.details?.superset_group===group):[e];
 const round=e.logged.slice(0,si+1).filter(s=>!s.is_warmup&&s.details?.kind!=='drop').length-1;
 const contributors=members.map(x=>{const primary=x.logged.filter(s=>!s.is_warmup&&s.details?.kind!=='drop')[round];if(!primary)return null;const at=x.logged.indexOf(primary),sets=[primary];for(let j=at+1;j<x.logged.length&&x.logged[j].details?.kind==='drop';j++)sets.push(x.logged[j]);return {x,sets};}).filter(Boolean);
 const results=contributors.map(({x,sets})=>restSuggestion(x,d.plan,sets.at(-1)));
 const result=results.reduce((a,b)=>b.seconds>a.seconds?b:a);
 return {...result,label:group?'Superset':e.name,set_ids:contributors.flatMap(({sets})=>sets.map(s=>s.runtime_set_id))};
}
