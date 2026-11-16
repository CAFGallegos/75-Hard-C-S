// Device-local presentation identities; never serialized into saved performance.
export function hydrateFocus(d,uuid=()=>crypto.randomUUID()) {
 const seen=new Set();for(const e of d.exercises){e.runtime_id??=uuid();for(const s of e.logged){if(!s.runtime_set_id||seen.has(s.runtime_set_id))s.runtime_set_id=uuid();seen.add(s.runtime_set_id);}}
 d.focus??={mode:'focused'};
 if(!d.exercises.some(e=>e.runtime_id===d.focus.exercise_runtime_id))d.focus.exercise_runtime_id=d.exercises.find(e=>e.logged.some(s=>!s.completed))?.runtime_id??d.exercises[0]?.runtime_id;
 return d.exercises.findIndex(e=>e.runtime_id===d.focus.exercise_runtime_id);
}
export function advanceFocus(d,ei,si){
 const e=d.exercises[ei],s=e.logged[si];if(!s.completed)return;
 let target;
 if(e.logged[si+1]?.details?.kind==='drop'&&!e.logged[si+1].completed)target=e;
 else if(e.details?.superset_group){
 const round=e.logged.slice(0,si+1).filter(v=>!v.is_warmup&&v.details?.kind!=='drop').length-1;
 target=d.exercises.find(x=>{if(x===e||x.details?.superset_group!==e.details.superset_group)return false;const primary=x.logged.filter(v=>!v.is_warmup&&v.details?.kind!=='drop')[round];if(!primary)return false;const at=x.logged.indexOf(primary);return !primary.completed||x.logged.slice(at+1).some((v,j,tail)=>v.details?.kind==='drop'&&!v.completed&&tail.slice(0,j).every(t=>t.details?.kind==='drop'));});
 }
 target??=e.logged.some(v=>!v.completed)?e:d.exercises.find(x=>x.logged.some(v=>!v.completed));
 if(target)d.focus.exercise_runtime_id=target.runtime_id;
}
