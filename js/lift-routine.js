import { catalogExercise } from './lift-catalog.js';
import { convertWeight } from './lift-rules.js';
// Carlos’s provided references and Sue’s requested focus template. No session seeding.
export const ROUTINE_ID='carlos-five-session-v1';
export const SUE_ROUTINE_ID='sue-glute-leg-v1';
export const SUE_FOCUS_PREFERENCES={split:'lower-upper',priorities:{glutes:'high',quadriceps:'high',hamstrings:'high'}};
// Explicit user-requested focus. A rotation, not five consecutive training days.
export const SUE_ROUTINE=[
 {name:'Lower A · Glutes + quads',exercises:[['Barbell_Hip_Thrust',2,8,12],['Leg_Press',2,8,12],['Seated_Leg_Curl',2,10,15],['Calf_Press_On_The_Leg_Press_Machine',1,12,15]]},
 {name:'Upper A · Push + pull',exercises:[['Dumbbell_Bench_Press',2,8,12],['Wide-Grip_Lat_Pulldown',2,8,12],['Side_Lateral_Raise',2,10,15],['Cable_Hammer_Curls_-_Rope_Attachment',1,10,15]]},
 {name:'Lower B · Glutes + hamstrings',exercises:[['Romanian_Deadlift',2,8,12],['Dumbbell_Step_Ups',2,8,12],['One-Legged_Cable_Kickback',2,10,15]]},
 {name:'Upper B · Back + shoulders',exercises:[['Seated_Cable_Rows',2,8,12],['Dumbbell_Shoulder_Press',2,8,12],['Triceps_Pushdown',1,10,15],['Crunches',2,10,15]]},
 {name:'Lower C · Glutes + legs',exercises:[['Butt_Lift_Bridge',2,10,15],['Leg_Press',2,10,15],['Lying_Leg_Curls',2,10,15],['Calf_Press_On_The_Leg_Press_Machine',1,12,15]]}
];
export function routineIdFor(person='los') {
  if(person==='los')return ROUTINE_ID;
  if(person==='sue')return SUE_ROUTINE_ID;
  throw new Error('Unknown Lift profile.');
}
export function routineFlagsFor(person='los') {
  if(person==='los')return ROUTINE_FLAGS;
  routineIdFor(person);
  return [
    'Your requested glute/leg emphasis: Lower A, Upper A, Lower B, Upper B, Lower C. Upper-body work is retained.',
    'A five-session rotation, not five consecutive training days. Choose training/rest days to fit your schedule and recovery.',
    'No weights, reps or RIR from Carlos’s performance are copied. External loads start blank; bodyweight movements assume no bodyweight. Every set starts unchecked.',
    'Mostly two working sets per exercise, with one for some accessories, with editable rep ranges, 3 RIR and 90–120 seconds rest, are starting assumptions rather than measured performance.',
    'This template assumes access to the listed barbell, dumbbell, cable and machine equipment. Review instructions and swap anything unavailable or unsuitable before training.'
  ];
}
export const ROUTINE_FLAGS=[
  'Source dates identify starting references, not completed workouts. All sets start unchecked.',
  'October 1 header says 6 exercises / 17 sets; the visible list contains 8 exercises / 23 sets. Visible entries are included once.',
  'Unspecified targets default to 8–12 reps, 2 RIR and 120 seconds rest. These are editable assumptions, separate from reference reps/RIR.',
  'Legs loads are unset. Kettle SQ Extension remains an unverified custom movement. No bodyweight is assumed.',
  'Routine movements remain custom until you explicitly choose a catalog mapping. Unspecified Reverse Flys / Lean Away variants keep equipment unverified.'
];
const refs=(values) => values.map(([weight,reps,rir]) => ({weight,reps,rir: typeof rir==='string'?Number(rir.replace('+','')):rir,rir_qualifier:typeof rir==='string'?'at_least':'exact',units:'lb'}));
const ex=(name,equipment,values,load_type='external') => ({name,equipment,values,load_type});
const repeat=(weight,reps,rir,n) => Array.from({length:n},()=>[weight,reps,rir]);
export const ROUTINE = [
 {name:'Push A',source:'June 28',exercises:[
  ex('Incline Bench Press, Barbell','barbell',[[185,6,1],[185,4,1],[135,9,0],[135,5,0]]),
  ex('Bench Press, Wide Grip, Barbell','barbell',[[135,11,'5+'],[185,12,.5],[185,9,.5]]),
  ex('Shoulder Press, Machine','machine',[[50,12,1],[50,12,1],[50,10,1]]),
  ex('Lateral Raises, Machine','machine',repeat(105,15,1,2)),
  ex('Reverse Butterfly, Wide Grip, Machine','machine',[[105,15,2],[105,15,1]]),
  ex('Dips, Weighted','bodyweight',[[25,15,1],[45,13,0]],'added'),
  ex('Overhead Triceps Extensions, Cable','cable',[[100,10,2],[100,10,1.5]])]},
 {name:'Pull A',source:'September 24',exercises:[
  ex('Pull-Ups, Wide Neutral Grip','bodyweight',[[0,10,0],[0,8,0],[0,5,0]],'bodyweight'),
  ex('Pullovers with Rope, Cable','cable',[[60,16,0],[100,11,2]]),
  ex('One-Arm Rows, Reverse Grip, Dumbbells','dumbbell',repeat(60,12,1,2)),
  ex('Lateral Raises, Dumbbells','dumbbell',[[15,20,.5],[15,18,1]]),
  ex('Lean Away Lateral Raises, Cable','cable',[[30,15,1.5],[30,15,1]]),
  ex('Reverse Flys, Cable','cable',repeat(30,12,1,2)),ex('Curls, Cable','cable',[[115,10,1],[115,10,0],[115,10,0]])]},
 {name:'Legs',source:'Planned program',exercises:[
  ['Sumo Hack Squats','machine',3,6],['Leg Press','machine',4,10],['Seated Leg Curls','machine',3,10],['Kettle SQ Extension','unspecified',3,10],['Calf Raises on Leg Press','machine',3,12],['Dragon Flag','bodyweight',3,10],['Side Crunches','bodyweight',2,12]
 ].map(([name,equipment,sets,reps])=>({...ex(name,equipment,Array.from({length:sets},()=>[null,reps,null]),equipment==='bodyweight'?'bodyweight':equipment==='unspecified'?'unknown':'external'),planned:true,reps}))},
 {name:'Push B',source:'September 26',exercises:[
  ex('High Cable Flys','cable',[[25,15,1],[25,15,1.5],[30,8,1]]),ex('Low Cable Flys','cable',[[25,12,1],[25,12,1.5]]),ex('Cable Flys','cable',[[25,12,1],[25,12,1.5]]),
  ex('Reverse Flys','unspecified',repeat(30,12,1,3),'unknown'),ex('Lean Away Lateral Raises','unspecified',[[30,15,1.5],[30,15,1],[30,15,1]],'unknown'),
  ex('Dips','bodyweight',[[0,9,1],[0,8,1],[0,8,3]],'bodyweight'),ex('Dragon Flag','bodyweight',[[0,6,1.5],[0,5,1],[0,4,0]],'bodyweight')]},
 {name:'Pull B',source:'October 1 visible list',exercises:[
  ex('Pull-Ups, Close Overhand Grip','bodyweight',[[0,11,.5],[0,10,.5],[0,8,.5]],'bodyweight'),ex('Pike Push Up','bodyweight',[[0,15,1],[0,15,0],[0,15,0]],'bodyweight'),
  ex('Lat Pulldowns, Wide Overhand Grip','cable',[[140,10,1],[160,10,1]]),ex('Cable Curls','cable',[[40,16,1],[60,10,0],[60,11,0]]),ex('Reverse Flys, Cable','cable',repeat(30,12,1,3)),
  ex('Lean Away Lateral Raises, Cable','cable',[[30,15,1.5],[30,15,1],[30,15,1]]),ex('Dips','bodyweight',[[0,9,1],[0,8,1],[0,8,3]],'bodyweight'),ex('Dragon Flag','bodyweight',[[0,6,1.5],[0,5,1],[0,4,0]],'bodyweight')]}
];
export function startingRoutine(plan, uuid=()=>crypto.randomUUID(), person='los', catalog=null) {
  const source=routineIdFor(person);
  if (plan.details?.imports?.includes(source)) throw new Error('This starting routine has already been loaded. Existing references and edits are preserved.');
  if(person==='sue'){
    if(!Array.isArray(catalog))throw new Error('Load the exercise catalog before previewing Sue’s routine.');
    const days=SUE_ROUTINE.map(day=>({id:uuid(),name:day.name,exercises:day.exercises.map(([id,sets,rep_min,rep_max])=>{
      const row=catalog.find(e=>e.id===id);if(!row)throw new Error(`Required exercise is missing from the pinned catalog: ${id}`);
      const exercise=catalogExercise(row,plan.units,uuid);
      return {...exercise,sets,rep_min,rep_max,target_rir:3,rest_seconds:row.mechanic==='compound'?120:90,
        notes:'Glute/leg emphasis requested. Choose your own load. Targets are editable starting assumptions; no previous performance is assumed.',
        details:{...exercise.details,references:[],source,target_assumptions:`${sets} sets, ${rep_min}–${rep_max} reps and 3 RIR are editable starting assumptions.`}};
    })}));
    const preferences={...(plan.details?.preferences??{}),split:SUE_FOCUS_PREFERENCES.split,priorities:{...plan.details?.preferences?.priorities,...SUE_FOCUS_PREFERENCES.priorities}};
    return {...structuredClone(plan),days,details:{...structuredClone(plan.details??{}),preferences,imports:[...(plan.details?.imports??[]),source]}};
  }
  const days=ROUTINE.map((d)=>({id:uuid(),name:d.name,exercises:d.exercises.map((e)=>({id:uuid(),name:e.name,equipment:e.equipment,sets:e.values.length,rep_min:e.planned?e.reps:8,rep_max:e.planned?e.reps:12,target_rir:2,increment:convertWeight(e.equipment==='dumbbell'?2.5:5,'lb',plan.units),rest_seconds:null,notes:`${d.source} source. ${e.planned?'Planned targets; loads not supplied.':'Starting reference, not a logged session. Targets 8–12 @ 2 RIR are editable assumptions.'}`,details:{load_type:e.load_type,apparatus:e.name,catalog_id:null,references:e.planned?[]:refs(e.values),target_assumptions:e.planned?'RIR 2 and rest 120s assumed.':'Rep range 8–12, RIR 2 and rest 120s assumed.',source:ROUTINE_ID}}))}));
  // Add alongside an existing plan; never replace the current rotation silently.
  return {...structuredClone(plan),days,details:{...structuredClone(plan.details??{}),imports:[...(plan.details?.imports??[]),source]}};
}
