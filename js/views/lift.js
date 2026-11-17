import {paintMuscles} from '../lift-muscles.js';
import {paintWorkoutImages,revealCurrentTile,resolveIllustration} from '../lift-visuals.js';
import {hydrateFocus,advanceFocus} from '../lift-focus.js';
import {restSuggestion,roundRest} from '../lift-rest.js';
import { openRoutine, openGenerator, openPrograms, openBackup, renderAnalytics } from '../lift-programs.js';
import { exerciseDraft, loadType, loadLabel, rirText, restEligible, togglePause, elapsedSeconds, safeMetrics, adjustment, EQUIPMENT } from '../lift-domain.js';
import { catalogExercise, loadCatalog, filterCatalog } from '../lift-catalog.js';
import { replacementCandidates, MUSCLES } from '../lift-generator.js';
import { routineIdFor } from '../lift-routine.js';
import { mountLibrary, showLibrary, showReference } from '../lift-library.js';
import { store } from '../store.js';
import { icon } from '../icons.js';
import { $, esc, sheet, confirmSheet, toast, fmtShort } from '../util.js';
import { lift, loadLift, savePlan, persistLift, saveDraft, finishLift, liftError, startRest, unlockSound } from '../lift-store.js';
import { warmups, plateMath, convertWeight, clean } from '../lift-rules.js';

let screen = 'home', historyExercise = '', historyRows = [], historyNext = null, historyToken = 0;
const n = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const button = (label, attrs = '', cls = 'btn-line') => `<button class="btn btn-sm ${cls}" ${attrs}>${label}</button>`;
const field = (label, name, value, attrs = '') => `<label class="lift-field"><span>${esc(label)}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const localDay = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: store.me.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (t) => parts.find((p) => p.type === t).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
function header() {
  if(screen==='home'&&lift.draft)return '';

  return `<header class="page-head"><span class="eyebrow">Your training · ${esc(store.me.name)}</span><h1 class="h1">Lift</h1>
    <p class="small">${icon('lock')} Your plan. Your numbers. Only you.</p></header>
    <nav class="lift-nav" aria-label="Lift screens">${[['home', 'Workout'], ['plan', 'Plan'], ['history', 'History'], ['progress', 'Progress']].map(([id, label]) => button(label, `data-screen="${id}" aria-pressed="${screen === id}"`, screen === id ? 'btn-me' : 'btn-line')).join('')}</nav><div class="lift-actions"><button class="btn btn-sm btn-line" data-library-open>Exercise library</button><button class="btn btn-sm btn-line" data-generator-open>Generate program</button><button class="btn btn-sm btn-line" data-programs-open>My programs</button><button class="btn btn-sm btn-line" data-backup-open>Backup</button></div>`;
}
export async function renderLift(root) {
  root.innerHTML = '<div class="view"><h1 class="h1">Lift</h1><p class="body" role="status">Loading your training…</p></div>';
  try {
    await loadLift();
    if (!root.isConnected) return;
    paint(root);
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = `<div class="view"><h1 class="h1">Lift</h1><p class="body" role="status">${esc(liftError(err))}</p>${button('Retry', 'data-retry')}</div>`;
    $('[data-retry]', root).onclick = () => renderLift(root);
  }
}
function paint(root) {
  if (!root.isConnected) return;
  root.innerHTML = `<div class="view lift-view">${header()}${lift.error ? `<p class="lift-notice" role="status">${esc(lift.error)}</p>` : ''}<div data-lift-content></div></div>`;
  root.onclick = async (ev) => {
    if (ev.target.closest('[data-generator-open]')) return openGenerator();
    if (ev.target.closest('[data-programs-open]')) return openPrograms();
    if (ev.target.closest('[data-backup-open]')) return openBackup();
    if (ev.target.closest('[data-routine-open]')) return openRoutine();
    if (ev.target.closest('[data-library-open]')) return showLibrary();
    const b = ev.target.closest('[data-screen]');
    if (!b) return;
    screen = b.dataset.screen; paint(root);
  };
  if (screen === 'progress') renderAnalytics($('[data-lift-content]', root));
  else if (screen === 'plan') renderPlan(root);
  else if (screen === 'history') renderHistory(root);
  else if (lift.draft) renderActive(root);
  else renderHome(root);
}
function renderHome(root) {
  const content = $('[data-lift-content]', root), { days, last_day_id: last } = lift.state;
  const day = days.length ? days[(days.findIndex((d) => d.id === last) + 1) % days.length] : null;
  content.innerHTML = day ? `<section class="card card-pad lift-next"><span class="eyebrow">Next in your rotation</span><h2 class="h-display">${esc(day.name)}</h2>
    <p class="body">${day.exercises.length} exercises · ${day.exercises.reduce((sum, e) => sum + e.sets, 0)} working sets</p>
    ${button(`${icon('workout')} Start workout`, `data-start="${day.id}" ${day.exercises.length ? '' : 'disabled'}`, 'btn-me btn-block')}
    ${day.exercises.length ? '' : '<p class="small">Add exercises in Plan to get started.</p>'}</section>
    <section class="section"><span class="eyebrow">Your days</span><div class="group">${days.map((d) => `<button class="row" data-preview-workout="${d.id}" ${d.exercises.length ? '' : 'disabled'}><span class="row-ico">${icon('workout')}</span><span class="txt"><span class="t">${esc(d.name)}</span><span class="d">${d.exercises.length} exercises</span></span><span class="end">Preview ${icon('chevR')}</span></button>`).join('')}</div></section>`
    : `<section class="card card-pad"><span class="eyebrow">A fresh start</span><h2 class="h2">Build your first workout</h2><p class="body">Add a day, choose your exercises, and make it yours.</p>${button('Create my plan', 'data-edit-plan', 'btn-me btn-block')}</section>`;
  if(day){content.querySelector('.lift-next').insertAdjacentHTML('afterbegin','<div class="lift-day-muscle-icon" data-day-muscles></div>');paintMuscles(content.querySelector('[data-day-muscles]'),day.exercises);}
  content.insertAdjacentHTML('afterbegin', `<button class="btn btn-line btn-block" data-routine-open ${lift.state.plan.details?.imports?.includes(routineIdFor(store.me.id)) ? 'disabled' : ''}>${lift.state.plan.details?.imports?.includes(routineIdFor(store.me.id)) ? 'Starting routine already loaded' : 'Load my starting routine'}</button>`);
  content.onclick = (ev) => {
    if (ev.target.closest('[data-edit-plan]')) { screen = 'plan'; return paint(root); }
    const preview=ev.target.closest('[data-preview-workout]');
    if(preview){const selected=days.find(d=>d.id===preview.dataset.previewWorkout);if(selected)openWorkoutPreview(root,selected);return;}
    const b = ev.target.closest('[data-start]'); if (!b) return;
    const selected = days.find(d=>d.id===b.dataset.start);
    if(selected)startWorkout(root,selected);
  };
}
function startWorkout(root,selected) {
    if(lift.draft)return toast('Finish or discard your current workout first.');
    if (!selected.exercises.length) return;
    const plan = lift.state.plan;
    lift.draft = { id: crypto.randomUUID(), lift_day_id: selected.id, day_name: selected.name, units: plan.units,
      day: localDay(), started_at: new Date().toISOString(), finished_at: null, notes: '', timer_end: null, plan: structuredClone(plan),
      pause_seconds: 0, paused_at: null, fatigue: null, planned_sets:selected.exercises.reduce((sum,e)=>sum+e.sets,0),
      exercises: selected.exercises.map(e=>exerciseDraft(e,lift.state)) };
    try { saveDraft(); unlockSound(); paint(root); } catch (err) { lift.draft = null; toast(liftError(err), { error: true }); }
}
function openWorkoutPreview(root,day) {
  const plan=lift.state.plan;
  const panel=sheet(`<div class="lift-form lift-workout-preview"><div class="lift-preview-top"><span class="eyebrow">Workout preview</span><button type="button" class="btn btn-line" data-close-preview-top aria-label="Close workout preview">&times;</button></div><div class="lift-exercise-head"><h2 class="h2">${esc(day.name)}</h2><div data-preview-muscles></div></div><p class="small">${day.exercises.length} exercises · ${day.exercises.reduce((sum,e)=>sum+e.sets,0)} working sets · ${esc(plan.units)}</p><button class="btn btn-me btn-block" data-start-preview ${day.exercises.length?'':'disabled'}>Start workout</button><div class="lift-preview-list">${day.exercises.map((e,i)=>`<details class="lift-preview-exercise"><summary><span class="lift-photo-thumb" data-workout-image="${i}">${icon('workout')}</span><span><strong>${esc(e.name)}</strong><span class="small">${e.sets} × ${e.rep_min}–${e.rep_max} reps · ${e.target_rir} RIR</span></span></summary><p class="small">${esc(e.equipment)} · ${esc(loadLabel(loadType(e),plan.units))}</p><p class="small">Rest ${restSuggestion(e,plan).seconds}s · ${esc(restSuggestion(e,plan).source)}</p>${(e.details?.references??[]).length?'<p class="small">Starting references · editable when you start</p>'+e.details.references.map(r=>`<p class="small">${r.weight??'Unset'} ${esc(r.units)} × ${r.reps} @ ${rirText(r)} RIR</p>`).join(''):''}${e.notes?`<p class="small">${esc(e.notes)}</p>`:''}<button class="btn btn-line" data-preview-reference="${i}">Exercise reference</button><button class="btn btn-line" data-guide-preview="${i}">Edit muscles / replace exercise</button></details>`).join('')}</div><button class="btn btn-line btn-block" data-close-preview>Close preview</button></div>`);
  paintMuscles(panel.el.querySelector('[data-preview-muscles]'),day.exercises);
  paintWorkoutImages(panel.el,day.exercises);
  panel.el.querySelector('[data-close-preview]').onclick=()=>panel.close();
  panel.el.querySelector('[data-close-preview-top]').onclick=()=>panel.close();
  panel.el.querySelector('[data-start-preview]').onclick=()=>{panel.close();startWorkout(root,day);};
  panel.el.querySelectorAll('[data-guide-preview]').forEach(b=>b.onclick=()=>{
    const p=editablePlan(),di=p.days.findIndex(d=>d.id===day.id),ei=p.days[di]?.exercises.findIndex(e=>e.id===day.exercises[Number(b.dataset.guidePreview)].id);
    if(di<0||ei<0)return toast('This plan changed. Reopen its editor.',{error:true});
    panel.close();screen='plan';paint(root);guidedExercise(root,di,ei);
  });
  panel.el.querySelectorAll('[data-preview-reference]').forEach(b=>b.onclick=()=>showReference(day.exercises[Number(b.dataset.previewReference)]));
}

function renderActive(root) {
  const d = lift.draft, content = $('[data-lift-content]', root), frozen = !!d.finished_at, locked = frozen || !!d.paused_at;
  const keepPosition = () => { const y=window.scrollY, open=[...content.querySelectorAll('details[open][data-panel]')].map(el=>el.dataset.panel); paint(root); for(const el of root.querySelectorAll('details[data-panel]'))el.open=open.includes(el.dataset.panel); window.scrollTo(0,y); };
  const navigate = () => { paint(root); root.querySelector('.lift-photo-rail')?.scrollIntoView({block:'start'}); };
  const focused=hydrateFocus(d);
  try{persistLift('draft',d);}catch(err){toast(liftError(err),{error:true});}
  const completed = d.exercises.flatMap(e=>e.logged).filter(s=>!s.is_warmup && s.completed).length;
  const total = d.exercises.flatMap(e=>e.logged).filter(s=>!s.is_warmup).length;
  content.innerHTML = `<div class="lift-session-head"><div><span class="eyebrow">Lift · ${frozen ? 'Waiting to save' : d.paused_at ? 'Paused' : 'In progress'}</span><h2 class="h2">${esc(d.day_name)}</h2></div><details class="lift-workout-menu" data-panel="controls"><summary>Workout menu</summary><div class="lift-actions">${button('Discard', 'data-discard', 'btn-ghost')}${button(d.paused_at?'Resume workout':'Pause workout', `data-pause ${frozen?'disabled':''}`)}${button('Add exercise', `data-add-active ${locked?'disabled':''}`)}${button('Update permanent plan',`data-update-permanent ${locked?'disabled':''}`)}${[['home','Workout'],['plan','Plan'],['history','History'],['progress','Progress']].map(([id,label])=>button(label,`data-screen="${id}"`)).join('')}${button('Exercise library','data-library-open')}${button('Generate program','data-generator-open')}${button('My programs','data-programs-open')}${button('Backup','data-backup-open')}</div></details></div>
    <p class="small lift-session-progress" data-workout-progress role="status">${completed} / ${total} working sets complete · ${Math.floor(elapsedSeconds(d)/60)} active minutes</p>
    ${frozen ? '<p class="lift-notice">Workout complete. Your draft stays here until the server confirms it. Retry Finish when connected.</p>' : ''}
    <nav class="lift-photo-rail" aria-label="Workout exercises">${d.exercises.map((e,i)=>{const done=e.logged.filter(s=>!s.is_warmup&&s.completed).length,total=e.logged.filter(s=>!s.is_warmup).length;return `<button class="lift-photo-tab ${i===focused?'is-current':''} ${total&&done===total?'is-done':''}" data-focus-index="${i}" aria-label="${i+1}. ${esc(e.name)}, ${done} of ${total} sets complete" ${i===focused?'aria-current="step"':''}><span class="lift-photo-thumb" data-workout-image="${i}">${icon('workout')}</span><span class="lift-photo-number">${total&&done===total?'✓':i+1}</span><span class="lift-photo-name">${esc(e.name)}</span></button>`;}).join('')}<button class="lift-photo-add" data-add-active aria-label="Add exercise" ${locked?'disabled':''}>+</button></nav>

    ${d.exercises.map((e, ei) => d.focus.mode!=='all'&&ei!==focused?'':`<section class="card card-pad lift-exercise lift-active-exercise"><div class="lift-exercise-head"><h3 class="h3">${esc(e.name)}</h3><div data-muscles="${ei}"></div></div><div class="lift-active-photos" data-workout-image="${ei}" aria-busy="true">${icon('workout')}<span>Loading illustration…</span></div><div class="lift-photo-caption"><span data-illustration-caption class="small"></span>${button('Choose illustration',`data-choose-illustration="${ei}" ${locked?'disabled':''}`,'btn-ghost')}</div>
      <div class="lift-active-meta"><span class="small">${e.rep_min}–${e.rep_max} reps · ${e.target_rir} RIR<br>${esc(loadLabel(loadType(e),d.units))}${e.details?.superset_group?' · Superset '+esc(e.details.superset_group):''}</span>${button(`Rest ${Math.floor(restSuggestion(e,d.plan).seconds/60)}:${String(restSuggestion(e,d.plan).seconds%60).padStart(2,'0')}`,`data-rest-policy="${ei}" ${locked?'disabled':''}`)}</div><p class="small lift-entry-hint">${e.last.length?'Suggested from previous performance':e.details?.references?.length?'Starting references · editable':'Suggested targets · choose your load'}<br>Today’s entries · check performed sets</p>
      <div class="lift-set-labels" aria-hidden="true"><span>Set</span><span>${loadType(e)==='bodyweight'?'BW':d.units}</span><span>Reps</span><span>RIR</span><span>Done</span></div>
      ${e.logged.map((s, si) => `<div class="lift-set ${s.completed ? 'complete' : ''}" data-set-row="${ei}:${si}"><span class="small">${s.is_warmup ? 'W' : s.details?.kind==='drop'?'D':s.set_no}</span>
        ${['weight', 'reps', 'rir'].map((key) => `${key==='rir'?'<span class="lift-rir-input">':''}<input type="number" inputmode="${key === 'reps' ? 'numeric' : 'decimal'}" min="${key === 'reps' ? 1 : 0}" max="${key === 'weight' ? 5000 : key === 'reps' ? 1000 : 10}" step="${key === 'reps' ? 1 : 'any'}" value="${s[key]??''}" aria-label="${esc(e.name)} ${s.is_warmup ? 'warm-up' : 'set'} ${s.set_no} ${key}${key==='rir'&&s.details?.rir_qualifier==='at_least'?' (at least)':''}" data-value="${ei}:${si}:${key}" ${locked || key==='weight'&&loadType(e)==='bodyweight' ? 'disabled' : ''}>${key==='rir'?`${s.details?.rir_qualifier==='at_least'?'<span class="lift-rir-plus" aria-hidden="true">+</span>':''}</span>`:''}`).join('')}
        <button class="lift-complete" data-complete="${ei}:${si}" aria-label="Complete ${esc(e.name)} ${s.is_warmup ? 'warm-up' : 'set'} ${s.set_no}" aria-pressed="${s.completed}" ${locked ? 'disabled' : ''}>${s.completed?icon('check'):'<span aria-hidden="true">○</span>'}</button></div>`).join('')}
      <details class="lift-set-options" data-panel="sets-${e.runtime_id}"><summary>Add / remove sets · RIR options</summary>${e.logged.map((s,si)=>`<div class="lift-set-tools"><span class="small">${s.is_warmup?'Warm-up':'Set'} ${s.set_no}</span>${button(`RIR ${s.details?.rir_qualifier==='at_least'?'≥':'exact'}`,`data-qualifier="${ei}:${si}" ${locked?'disabled':''}`,'btn-ghost')}${button('Remove set',`data-remove-set="${ei}:${si}" ${locked?'disabled':''}`,'btn-ghost')}</div>`).join('')}
      <div class="lift-actions">${button('Add working set',`data-extra-set="${ei}:working" ${locked?'disabled':''}`)}${button('Add drop set',`data-extra-set="${ei}:drop" ${locked?'disabled':''}`)}${button('Warm-ups', `data-warm="${ei}" ${locked || e.logged.some((s) => s.is_warmup) ? 'disabled' : ''}`)}${e.equipment === 'barbell' ? button('Plates', `data-plates="${ei}"`) : ''}</div></details>
      <p class="small lift-previous">Previous confirmed: ${e.last.length ? e.last.map(s=>`${n(s.weight)} ${esc(d.units)} × ${s.reps} @ ${rirText(s)} RIR`).join(' · ') : 'No previous session'}</p>
<details class="lift-exercise-more" data-panel="exercise-${e.runtime_id}"><summary>Exercise details &amp; options</summary>      <p class="small lift-reason">Recommendation: ${esc(e.reason)}</p><details><summary>Starting numbers</summary>${(e.details?.references??[]).map(r=>`<p class="small">${r.weight??'Unset'} ${esc(r.units)} × ${r.reps} @ ${rirText(r)} RIR</p>`).join('')||'<p class="small">No supplied starting references.</p>'}</details>${adjustment(e,lift.state.recent?.[e.id]??[],d.fatigue,d.units).map(t=>`<p class="small">${esc(t)}</p>`).join('')}<p class="small">${e.details?.target_assumptions?esc(e.details.target_assumptions):''}</p><p class="small">${esc(loadLabel(loadType(e),d.units))}${e.details?.apparatus?' · '+esc(e.details.apparatus):''}${e.details?.superset_group?' · Superset '+esc(e.details.superset_group):''}</p><div class="lift-actions">${button('Reference',`data-reference="${ei}"`)}${button('Edit for this workout',`data-edit-active="${ei}" ${locked?'disabled':''}`)}${button('Substitute',`data-swap-active="${ei}" ${locked?'disabled':''}`)}${button('↑',`data-active-move="${ei}:-1" aria-label="Move exercise up" ${locked||ei===0?'disabled':''}`)}${button('↓',`data-active-move="${ei}:1" aria-label="Move exercise down" ${locked||ei===d.exercises.length-1?'disabled':''}`)}${button('Remove',`data-remove-active="${ei}" ${locked?'disabled':''}`)}</div>
      <label class="lift-field"><span>Exercise notes</span><textarea rows="2" maxlength="1000" data-notes="${ei}" ${locked ? 'disabled' : ''}>${esc(e.notes)}</textarea></label></details></section>`).join('')}
    <nav class="lift-actions" aria-label="Exercise navigation">${button('Previous',`data-focus-index="${focused-1}" ${focused<=0?'disabled':''}`)}${button('Exercise overview','data-focus-overview')}${button('Next',`data-focus-index="${focused+1}" ${focused>=d.exercises.length-1?'disabled':''}`)}${button(d.focus.mode==='all'?'One exercise':'All exercises','data-focus-mode')}</nav>
    <details class="lift-workout-menu" data-panel="notes"><summary>Workout notes &amp; fatigue</summary><label class="lift-field"><span>Workout notes</span><textarea rows="2" maxlength="2000" data-session-notes ${locked ? 'disabled' : ''}>${esc(d.notes)}</textarea></label>
    <label class="lift-field"><span>Reported fatigue (optional)</span><select data-fatigue ${locked?'disabled':''}><option value="">Not reported</option>${[1,2,3,4,5].map(v=>`<option value="${v}" ${d.fatigue===v?'selected':''}>${v} / 5${v===1?' · fresh':v===5?' · very fatigued':''}</option>`).join('')}</select></label><p class="small">Warm-ups do not start rest. Drop sets are separate working efforts; rest starts after the final drop. Superset rest starts when every member with that numbered round completes it; extra rounds rest normally. Pause freezes elapsed time and remaining rest.</p></details><button class="btn btn-me btn-block lift-finish" data-finish ${d.paused_at?'disabled':''}>${frozen ? 'Retry Finish' : 'Finish workout'}</button>`;
  paintWorkoutImages(content,d.exercises,d.illustrations??{});
  revealCurrentTile(content);
  content.querySelectorAll('[data-muscles]').forEach(host=>paintMuscles(host,[d.exercises[Number(host.dataset.muscles)]]));
  content.oninput = (ev) => {
    const t = ev.target;
    if (locked) return;
    if (t.hasAttribute('data-fatigue')) d.fatigue=t.value?Number(t.value):null;
    else if (t.dataset.value) {
      const [ei, si, key] = t.dataset.value.split(':'); d.exercises[ei].logged[si][key] = t.value === '' ? null : Number(t.value);
    } else if (t.dataset.notes !== undefined) d.exercises[t.dataset.notes].notes = t.value;
    else if (t.hasAttribute('data-session-notes')) d.notes = t.value;
    try { saveDraft(); } catch (err) { toast(liftError(err), { error: true, ms: 7000 }); }
  };
  content.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if(b.dataset.focusIndex!==undefined){const e=d.exercises[Number(b.dataset.focusIndex)];if(e){d.focus.exercise_runtime_id=e.runtime_id;d.focus.mode='focused';saveDraft();navigate();}return;}
      if(b.hasAttribute('data-focus-mode')){d.focus.mode=d.focus.mode==='all'?'focused':'all';saveDraft();return keepPosition();}
      if(b.hasAttribute('data-focus-overview')){const picker=sheet('<div class="lift-form"><h2 class="h2">Exercises</h2>'+d.exercises.map((e,i)=>`<button class="btn btn-line btn-block" data-jump="${i}" ${i===focused?'aria-current="true"':''}>${esc(e.name)} · ${e.logged.filter(s=>s.completed&&!s.is_warmup).length}/${e.logged.filter(s=>!s.is_warmup).length}</button>`).join('')+'</div>');picker.el.onclick=ev=>{const t=ev.target.closest('[data-jump]');if(t){d.focus.exercise_runtime_id=d.exercises[Number(t.dataset.jump)].runtime_id;d.focus.mode='focused';saveDraft();picker.close();navigate();}};return;}
      if(b.dataset.restPolicy!==undefined&&!locked){const e=d.exercises[Number(b.dataset.restPolicy)];const p=sheet('<form class="lift-form"><h2 class="h2">Workout rest</h2><p class="small">'+esc(restSuggestion(e,d.plan).source)+' · '+esc(restSuggestion(e,d.plan).reason)+'</p><label class="lift-field"><span>Rest mode</span><select name="mode"><option value="auto">Suggested</option><option value="default">Plan default</option><option value="custom">Custom</option></select></label><label class="lift-field"><span>Custom seconds (zero allowed)</span><input name="seconds" type="number" min="0" max="3600" value="'+(e.rest_seconds??d.plan.default_rest_seconds)+'"></label><button class="btn btn-me">Apply to this workout</button></form>');$('[name=mode]',p.el).value=e.rest_seconds!=null?'custom':e.details?.rest_policy??'default';$('form',p.el).onsubmit=ev=>{ev.preventDefault();const mode=$('[name=mode]',p.el).value;e.rest_seconds=mode==='custom'?Number($('[name=seconds]',p.el).value):null;e.details={...e.details,rest_policy:mode==='auto'?'auto':'default'};saveDraft();p.close();keepPosition();};return;}
      if(b.dataset.chooseIllustration!==undefined&&!locked){
        const exercise=d.exercises[Number(b.dataset.chooseIllustration)];
        const picker=sheet('<div class="lift-form"><h2 class="h2">Choose reference illustration</h2><p class="small">For this workout draft only. Photos do not replace your exercise, equipment, starting references or history. Compare the shown grip and apparatus before choosing.</p><button class="btn btn-line" data-reset-illustration>Use automatic illustration</button><button class="btn btn-line" data-close-illustration>Cancel</button><label class="lift-field"><span>Find a reference photo</span><input type="search" data-illustration-search placeholder="Exercise name or equipment"></label><div data-illustration-picker></div></div>');
        $('[data-close-illustration]',picker.el).onclick=()=>picker.close();
        $('[data-reset-illustration]',picker.el).onclick=()=>{delete (d.illustrations??{})[exercise.runtime_id];saveDraft();picker.close();keepPosition();};
        const host=$('[data-illustration-picker]',picker.el);host.textContent='Loading illustrations…';
        try {
          const catalog=(await loadCatalog()).filter(row=>row.images?.length);if(!host.isConnected)return;
          const show=()=>{const matches=filterCatalog(catalog,$('[data-illustration-search]',picker.el).value);const rows=matches.slice(0,20);
            host.innerHTML='<p class="small">'+matches.length+' matches · showing '+rows.length+'. Refine search for more.</p>'+rows.map((row,i)=>`<button class="lift-illustration-choice" data-illustration-id="${esc(row.id)}"><span class="lift-photo-thumb" data-workout-image="${i}">${icon('workout')}</span><span>${esc(row.name)}<small>${esc(row.equipment??'Unspecified equipment')} · Choose illustration</small></span></button>`).join('');
            paintWorkoutImages(host,rows.map(row=>({runtime_id:row.id,name:row.name,details:{catalog_id:row.id}})));
          };
          $('[data-illustration-search]',picker.el).oninput=show;
          host.onclick=ev=>{const choice=ev.target.closest('[data-illustration-id]');if(!choice)return;d.illustrations??={};d.illustrations[exercise.runtime_id]=choice.dataset.illustrationId;saveDraft();picker.close();keepPosition();};show();
        } catch {host.textContent='Illustrations unavailable offline. Keep logging and try again when connected.';}
        return;
      }
      if (b.dataset.reference !== undefined) return showReference(d.exercises[b.dataset.reference]);
      if (b.hasAttribute('data-pause')) { togglePause(d); saveDraft(); return keepPosition(); }
      if (locked && !b.hasAttribute('data-finish') && !b.hasAttribute('data-discard') && b.dataset.plates===undefined) return;
      if (b.dataset.qualifier) { const [ei,si]=b.dataset.qualifier.split(':'); const set=d.exercises[ei].logged[si]; set.details={...set.details,rir_qualifier:set.details?.rir_qualifier==='at_least'?'exact':'at_least'}; saveDraft(); return keepPosition(); }
      if (b.dataset.removeSet) { const [ei,si]=b.dataset.removeSet.split(':'); if(d.exercises[ei].logged[si].completed&&!await confirmSheet({title:'Remove completed set?',body:'This removes its unsaved performance from this workout.',ok:'Remove set'}))return;d.exercises[ei].logged.splice(Number(si),1); renumber(d.exercises[ei]); saveDraft();return keepPosition(); }
      if (b.dataset.extraSet) { const [ei,kind]=b.dataset.extraSet.split(':'); const e=d.exercises[ei];if(e.logged.length>=30)throw new Error('Up to 30 sets per exercise.');const last=e.logged.findLast(s=>!s.is_warmup);e.logged.push({...structuredClone(last??{weight:null,reps:e.rep_min,rir:e.target_rir}),completed:false,is_warmup:false,details:{...last?.details,kind}});renumber(e);if(kind==='drop')d.timer_end=null;saveDraft();return keepPosition(); }
      if (b.dataset.activeMove) { const [ei,by]=b.dataset.activeMove.split(':').map(Number);[d.exercises[ei],d.exercises[ei+by]]=[d.exercises[ei+by],d.exercises[ei]];saveDraft();return keepPosition(); }
      if (b.dataset.removeActive!==undefined) { if(!await confirmSheet({title:'Remove this workout exercise?',body:'Its unsaved sets will be removed. Your permanent plan and saved history stay unchanged.',ok:'Remove'}))return;d.exercises.splice(Number(b.dataset.removeActive),1);saveDraft();return keepPosition(); }
      if (b.hasAttribute('data-add-active')||b.dataset.swapActive!==undefined) {
        const picker=sheet('<div class="lift-form"><h2 class="h2">Workout-only selection</h2><p class="small">Your permanent plan stays unchanged. Substitution removes this exercise’s unsaved sets after confirmation.</p><div data-active-alternatives></div><div data-active-picker></div></div>');
        const choose = async row=>{if(b.dataset.swapActive!==undefined&&!await confirmSheet({title:'Substitute for this workout?',body:'This replaces unsaved sets for this exercise. Your plan is unchanged.',ok:'Substitute'}))return;if(d.exercises.length>=30&&b.hasAttribute('data-add-active'))return toast('Up to 30 exercises.',{error:true});const e=exerciseDraft(catalogExercise(row,d.units),{plan:d.plan,recent:{}});e.temporary=true;if(b.dataset.swapActive!==undefined)d.exercises[Number(b.dataset.swapActive)]=e;else d.exercises.push(e);saveDraft();picker.close();keepPosition();};
        mountLibrary($('[data-active-picker]',picker.el),choose);
        if(b.dataset.swapActive!==undefined){const candidates=replacementCandidates(d.exercises[b.dataset.swapActive],await loadCatalog(),{...d.plan.details?.preferences,favorites:d.plan.details?.favorites??[]});const host=$('[data-active-alternatives]',picker.el);if(candidates.length){host.innerHTML='<h3 class="h3">Optional replacements</h3>'+candidates.map((x,i)=>`<p class="small">${esc(x.reason)}</p><button class="btn btn-line btn-block" data-alternative="${i}">${esc(x.exercise.name)}</button>`).join('');host.onclick=async ev=>{const option=ev.target.closest('[data-alternative]');if(option)try{await choose(candidates[Number(option.dataset.alternative)].exercise);}catch(err){toast(err.message,{error:true});}};}}
        return;
      }
      if (b.hasAttribute('data-update-permanent')) {
        if(lift.edit?._dirty)throw new Error('Save or reload unsaved plan edits first.');
        const day=lift.state.days.find(x=>x.id===d.lift_day_id);if(!day)throw new Error('This day is not in the active plan. Keep these workout-only changes.');
        if(!d.exercises.length)throw new Error('Keep at least one exercise.');
        if(!await confirmSheet({title:'Update this permanent plan day?',body:'This explicitly applies workout names, exercise order, equipment, groups and working-set counts to this plan day. Logged performance is saved only when you Finish.',ok:'Update plan day'}))return;
        const updated=d.exercises.map(e=>({...e,sets:Math.max(1,e.logged.filter(s=>!s.is_warmup&&s.details?.kind!=='drop').length)}));
        await savePlan({...lift.state.plan,days:lift.state.days.map(x=>x.id===day.id?{...x,exercises:updated}:x)});
        d.exercises.forEach(e=>e.temporary=false);saveDraft();toast('Permanent plan day updated explicitly.');return;
      }
      if (b.dataset.editActive!==undefined) return editActiveExercise(d.exercises[b.dataset.editActive],()=>{saveDraft();keepPosition();});
      if (b.hasAttribute('data-discard')) {
        if (!await confirmSheet({ title: 'Discard this draft?', body: 'Unsaved sets on this device will be removed. A workout already saved on the server stays in History.', ok: 'Discard', danger: true })) return;
        persistLift('draft', null); lift.draft = null; saveDraft(); return paint(root);
      }
      if (b.dataset.complete) {
        const [ei, si] = b.dataset.complete.split(':'); const e = d.exercises[ei], s = e.logged[si];
        const row = b.closest('[data-set-row]');
        if (!s.completed && [...row.querySelectorAll('input')].some((i) => i.value === '' || !i.reportValidity())) return;
        s.completed = !s.completed; saveDraft();
        b.setAttribute('aria-pressed', String(s.completed)); row.classList.toggle('complete', s.completed);
        if(!s.completed&&d.timer_context?.set_ids?.includes(s.runtime_set_id))d.timer_end=null;
        if (restEligible(d, Number(ei), Number(si))){const rest=roundRest(d,Number(ei),Number(si));startRest(rest.seconds,rest);}
        const previousFocus=d.focus.exercise_runtime_id;advanceFocus(d,Number(ei),Number(si));saveDraft();return previousFocus===d.focus.exercise_runtime_id?keepPosition():navigate();
      }
      if (b.dataset.warm !== undefined) {
        const e = d.exercises[b.dataset.warm], weight = e.logged.find((s) => !s.is_warmup)?.weight ?? 0;
        const ramp = warmups(weight, e, d.plan).map((s, i) => ({ ...s, set_no: i + 1 }));
        if (!ramp.length) return toast('Set a working weight above your warm-up load first.');
        e.logged.unshift(...ramp.map(s=>({...s,details:{load_type:loadType(e),equipment:e.equipment,kind:'warmup',rir_qualifier:'exact'}}))); saveDraft(); keepPosition();
      }
      if (b.dataset.plates !== undefined) {
        const e = d.exercises[b.dataset.plates]; showPlates(d.plan, e.logged.find((s) => !s.is_warmup)?.weight ?? d.plan.bar_weight);
      }
      if (b.hasAttribute('data-finish')) {
        const complete = d.exercises.flatMap((e) => e.logged).filter((s) => s.completed);
        if (!complete.some((s) => !s.is_warmup)) return toast('Complete at least one working set first.', { error: true });
        if (complete.some((s) => !Number.isFinite(s.weight) || s.weight < 0 || s.weight > 5000 || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > 1000 || !Number.isFinite(s.rir) || s.rir < 0 || s.rir > 10)) return toast('Check the numbers in your completed sets.', { error: true });
        const remaining = d.exercises.flatMap((e) => e.logged).filter((s) => !s.is_warmup && !s.completed).length;
        if (!frozen && remaining && !await confirmSheet({ title: 'Finish with unfinished sets?', body: `${remaining} working sets are unfinished. Only completed sets will be saved.`, ok: 'Finish workout' })) return;
        b.disabled = true; b.textContent = 'Saving…';
        const result = await finishLift();
        if (!result) return;
        toast('Workout saved. Only you can see it.', { ico: 'lock' });
        await loadLift(); paint(root); await confirmSheet({title:'Workout saved',body:`${complete.filter(s=>!s.is_warmup&&s.details?.kind!=='drop').length} primary sets · ${complete.filter(s=>s.details?.kind==='drop').length} drops · ${complete.filter(s=>s.is_warmup).length} warm-ups · ${Math.floor((d.duration_seconds??0)/60)} active minutes. External-load volume: ${safeMetrics(complete).volume} ${d.units} × reps.`,ok:'Continue'}); await offerCredit(result.day);
      }
    } catch (err) {
      toast(liftError(err), { error: true, ms: 6000 });
      if (b.hasAttribute('data-finish')) { b.disabled = false; b.textContent = d.finished_at ? 'Retry Finish' : 'Finish workout'; }
      if (lift.draft?.finished_at) paint(root);
    }
  };
}
function showPlates(plan, target) {
  const s = sheet(`<h2 class="h2">Plates per side</h2>${field(`Target (${plan.units})`, 'target', target, 'type="number" min="0" max="5000" step="any" inputmode="decimal"')}<div data-plate-result></div><button class="btn btn-primary btn-block" data-close>Done</button>`);
  const update = () => {
    try {
      const p = plateMath(Number($('[name=target]', s.el).value), plan.bar_weight, plan.plates);
      $('[data-plate-result]', s.el).innerHTML = `<p class="body">${p.plates.length ? p.plates.map(n).join(' + ') : 'Empty bar'}</p><p class="small">${n(plan.bar_weight)} ${plan.units} bar · loaded total ${n(p.actual)} ${plan.units}</p><p class="small">${p.belowBar ? 'Target is below the empty bar.' : p.leftover ? `${n(p.leftover)} ${plan.units} cannot be loaded with these plates.` : 'Exact match'}</p>`;
    } catch { $('[data-plate-result]', s.el).textContent = 'Check your target and plate settings.'; }
  };
  $('[name=target]', s.el).oninput = update; $('[data-close]', s.el).onclick = () => s.close(); update();
}
async function offerCredit(day) {
  if (day !== localDay()) return;
  try { await store.refresh(); } catch { return; }
  const entry = store.entry(day) ?? {}, choices = ['w1', 'w2'].filter((k) => !entry[k]);
  if (!choices.length) return;
  const s = sheet(`<h2 class="h2">Count toward 75 Hard?</h2><p class="body">Choose only if this was a 45-minute workout. Workout 2 also needs to have been outdoors.</p><div class="actions">${choices.map((k) => button(`Count as Workout ${k === 'w1' ? 1 : 2}`, `data-credit="${k}"`, 'btn-me btn-block')).join('')}${button('Not now', 'data-close', 'btn-ghost btn-block')}</div>`);
  $('[data-close]', s.el).onclick = () => s.close();
  s.el.querySelectorAll('[data-credit]').forEach((b) => b.onclick = async () => {
    s.el.querySelectorAll('button').forEach((x) => x.disabled = true);
    try { store.setData(await store.api('set', { day, fields: { [b.dataset.credit]: true } })); s.close(); toast('Workout checked off.'); }
    catch (err) { toast(liftError(err), { error: true }); s.el.querySelectorAll('button').forEach((x) => x.disabled = false); }
  });
}

function editablePlan() {
  if (!lift.edit) { lift.edit = { ...structuredClone(lift.state.plan), days: structuredClone(lift.state.days), _dirty: false }; persistLift('edit', lift.edit); }
  return lift.edit;
}
const keepEdit = () => { lift.edit._dirty = true; persistLift('edit', lift.edit); };
function renderPlan(root) {
  const p = editablePlan(), content = $('[data-lift-content]', root);
  content.innerHTML = `<p class="small">Changes stay as a draft until you save. Swapping an exercise starts a new history; renaming keeps its history.</p>
    <div class="lift-actions">${button('Add day', 'data-add-day', 'btn-me')}${button('Save plan', 'data-save-plan', 'btn-primary')}${button('Reload saved', 'data-reset-plan', 'btn-ghost')}</div>
    ${p.days.map((d, di) => `<section class="card card-pad lift-exercise"><div class="lift-exercise-head"><h2 class="h2">${esc(d.name)}</h2>${button('Rename', `data-day-edit="${di}"`)}</div>
      <div class="lift-actions">${button('↑', `data-day-move="${di}:-1" aria-label="Move ${esc(d.name)} up" ${di === 0 ? 'disabled' : ''}`)}${button('↓', `data-day-move="${di}:1" aria-label="Move ${esc(d.name)} down" ${di === p.days.length - 1 ? 'disabled' : ''}`)}${button('Delete day', `data-day-delete="${di}"`, 'btn-ghost')}</div>
      ${d.exercises.map((e, ei) => `<div class="lift-plan-exercise"><h3 class="h3">${esc(e.name)}</h3><p class="small">${e.sets} × ${e.rep_min}–${e.rep_max} · ${e.target_rir} RIR · ${esc(e.equipment)} · +${n(e.increment)} ${p.units}</p><div class="lift-actions">
        ${button('Edit', `data-ex-edit="${di}:${ei}"`)}${button('Muscles / similar', `data-ex-guide="${di}:${ei}"`)}${button('Swap', `data-ex-swap="${di}:${ei}"`)}${button('↑', `data-ex-move="${di}:${ei}:-1" aria-label="Move ${esc(e.name)} up" ${ei === 0 ? 'disabled' : ''}`)}${button('↓', `data-ex-move="${di}:${ei}:1" aria-label="Move ${esc(e.name)} down" ${ei === d.exercises.length - 1 ? 'disabled' : ''}`)}${button('Delete', `data-ex-delete="${di}:${ei}"`, 'btn-ghost')}</div></div>`).join('')}
      ${button('Add exercise', `data-ex-add="${di}"`, 'btn-me btn-block')}</section>`).join('')}`;
  content.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if (b.hasAttribute('data-add-day') || b.dataset.dayEdit !== undefined) {
        if (b.hasAttribute('data-add-day') && p.days.length >= 14) return toast('Up to 14 days per plan.');
        const index = b.dataset.dayEdit === undefined ? null : Number(b.dataset.dayEdit);
        const s = sheet(`<form><h2 class="h2">${index === null ? 'Add' : 'Rename'} day</h2>${field('Day name', 'name', index === null ? '' : p.days[index].name, 'required maxlength="100"')}<button class="btn btn-me btn-block" type="submit">Keep change</button></form>`);
        $('form', s.el).onsubmit = (e) => { e.preventDefault(); const name = $('[name=name]', s.el).value.trim(); if (!name) return;
          if (index === null) p.days.push({ id: crypto.randomUUID(), name, exercises: [] }); else p.days[index].name = name;
          keepEdit(); s.close(); renderPlan(root); };
      }
      if (b.dataset.dayMove) { const [i, by] = b.dataset.dayMove.split(':').map(Number); [p.days[i], p.days[i + by]] = [p.days[i + by], p.days[i]]; keepEdit(); renderPlan(root); }
      if (b.dataset.dayDelete !== undefined && await confirmSheet({ title: 'Delete this day?', body: 'Your logged workouts stay in History.', ok: 'Delete', danger: true })) { p.days.splice(Number(b.dataset.dayDelete), 1); keepEdit(); renderPlan(root); }
      if (b.dataset.exAdd !== undefined) editExercise(root, Number(b.dataset.exAdd), null, false);
      if (b.dataset.exEdit) { const [di, ei] = b.dataset.exEdit.split(':').map(Number); editExercise(root, di, ei, false); }
      if (b.dataset.exGuide) { const [di,ei]=b.dataset.exGuide.split(':').map(Number); guidedExercise(root,di,ei); }
      if (b.dataset.exSwap) { const [di, ei] = b.dataset.exSwap.split(':').map(Number); editExercise(root, di, ei, true); }
      if (b.dataset.exMove) { const [di, ei, by] = b.dataset.exMove.split(':').map(Number), a = p.days[di].exercises; [a[ei], a[ei + by]] = [a[ei + by], a[ei]]; keepEdit(); renderPlan(root); }
      if (b.dataset.exDelete && await confirmSheet({ title: 'Delete this exercise?', body: 'Its workout history will still be available.', ok: 'Delete', danger: true })) { const [di, ei] = b.dataset.exDelete.split(':').map(Number); p.days[di].exercises.splice(ei, 1); keepEdit(); renderPlan(root); }
      if (b.hasAttribute('data-save-plan')) { b.disabled = true; await savePlan(p); toast('Your plan is saved.'); paint(root); }
      if (b.hasAttribute('data-reset-plan') && await confirmSheet({ title: 'Reload saved plan?', body: 'This replaces your unsaved plan edits with the last server version.', ok: 'Reload' })) {
        // Do not discard edits if the network refresh fails.
        await loadLift(); if (lift.error) throw new Error(lift.error);
        persistLift('edit', null); lift.edit = null; paint(root);
      }
    } catch (err) { b.disabled = false; toast(liftError(err), { error: true, ms: 7000 }); }
  };
}
async function guidedExercise(root,di,ei) {
  const p=editablePlan(),e=p.days[di].exercises[ei];
  const panel=sheet('<div class="lift-form"><h2 class="h2">Muscles &amp; similar exercises</h2><div data-guide-body>Loading library…</div><button class="btn btn-line btn-block" data-guide-close>Cancel</button></div>');
  $('[data-guide-close]',panel.el).onclick=()=>panel.close();
  try {
    const [catalog,localMedia]=await Promise.all([loadCatalog(),Promise.all(['exercise-data.json','lift-media.json'].map(name=>fetch(new URL('../'+name,import.meta.url)).then(r=>{if(!r.ok)throw Error('Photo list unavailable');return r.json();}))).then(rows=>rows.flat())]);if(!panel.el.isConnected)return;
    const localPhotoIds=new Set(localMedia.filter(x=>x.images?.length).map(x=>x.id));
    const match=resolveIllustration(e,catalog),row=['confirmed','matched'].includes(match.kind)?match.row:null;
    const primary=new Set(e.details?.primaryMuscles??row?.primaryMuscles??[]),secondary=new Set(e.details?.secondaryMuscles??row?.secondaryMuscles??[]);
    const muscles=[...new Set([...MUSCLES,...catalog.flatMap(x=>[...x.primaryMuscles,...x.secondaryMuscles])])].sort();
    const host=$('[data-guide-body]',panel.el);
    host.innerHTML=`<h3 class="h3">${esc(e.name)}</h3><p class="small">Choose the muscles you intend to train. Similar muscles do not guarantee the same technique or suitability. Changes stay in your plan draft until Save plan; active workouts and History stay unchanged.</p><details open><summary>Target muscles</summary>${['Primary','Secondary'].map(kind=>`<fieldset><legend>${kind}</legend><div class="lift-muscle-options">${muscles.map(m=>`<label><input type="checkbox" data-muscle-kind="${kind}" value="${esc(m)}" ${(kind==='Primary'?primary:secondary).has(m)?'checked':''}> ${esc(m)}</label>`).join('')}</div></fieldset>`).join('')}</details><label class="lift-field"><span>Instructions / notes</span><textarea data-guide-notes maxlength="1000">${esc(e.notes??'')}</textarea></label><button class="btn btn-line btn-block" data-keep-custom>Keep as custom exercise</button><label class="lift-field"><span>Replacement equipment</span><select data-guide-equipment><option value="">All equipment</option>${EQUIPMENT.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label class="lift-muscle-photo-filter"><input type="checkbox" data-guide-photos checked> Only exercises with included photos</label><div data-guide-results></div>`;
    const targets=()=>{const read=k=>[...host.querySelectorAll(`[data-muscle-kind="${k}"]:checked`)].map(x=>x.value);const a=read('Primary');return {primaryMuscles:a,secondaryMuscles:read('Secondary').filter(x=>!a.includes(x))};};
    const finish=()=>{keepEdit();panel.close();renderPlan(root);toast('Change kept in draft. Save plan to apply.');};
    $('[data-keep-custom]',host).onclick=()=>{
      const t=targets();if(!t.primaryMuscles.length)return toast('Select at least one primary muscle.',{error:true});
      const id=e.details?.catalog_id?.startsWith('custom-')?e.details.catalog_id:(p.details?.custom??[]).find(x=>x.name===e.name&&x.equipment===e.equipment)?.id??'custom-'+crypto.randomUUID();
      const notes=$('[data-guide-notes]',host).value;
      const custom={id,name:e.name,equipment:e.equipment,...t,instructions:notes?[notes]:[],images:[],category:'strength',level:null};
      const existing=p.details?.custom??[];if(existing.length>=1000&&!existing.some(x=>x.id===id))return toast('Custom library is full.',{error:true});
      p.details={...p.details,custom:[...existing.filter(x=>x.id!==id),custom]};
      e.details={...e.details,...t};
      // Keep a confirmed photo identity when only editing targets; unmatched entries become custom.
      if(!row)e.details={...e.details,catalog_id:id,source:'custom',source_revision:null};
      e.notes=notes;finish();
    };
    const refresh=()=>{
      const t=targets(),equipment=$('[data-guide-equipment]',host).value;
      const pool=catalog.filter(x=>!$('[data-guide-photos]',host).checked||localPhotoIds.has(x.id));
      const candidates=replacementCandidates({...e,details:{...e.details,catalog_id:e.details?.catalog_id??row?.id,...t}},pool,{...p.details?.preferences,equipment:equipment?[equipment]:EQUIPMENT});
      const results=$('[data-guide-results]',host);
      results.innerHTML=!t.primaryMuscles.length?'<p class="small">Select primary muscles to find similar exercises.</p>':!candidates.length?'<p class="small">No matching exercises. Try another equipment filter or turn off the photo filter. You can keep your own movement above.</p>':candidates.map((x,i)=>`<section class="card card-pad"><div class="lift-exercise-head"><span class="lift-photo-thumb" data-workout-image="${i}"></span><h3 class="h3">${esc(x.exercise.name)}</h3></div><p class="small">${esc(x.reason)} Secondary: ${esc(x.exercise.secondaryMuscles.join(', ')||'none listed')}.</p><details><summary>Technique &amp; equipment</summary><p class="small">${esc(x.exercise.equipment??'unspecified')}</p><ol>${x.exercise.instructions.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></details><button class="btn btn-me btn-block" data-guided-replace="${i}">Replace with this exercise</button></section>`).join('');
      paintWorkoutImages(results,candidates.map(x=>catalogExercise(x.exercise,p.units)));
      results.querySelectorAll('[data-guided-replace]').forEach(b=>b.onclick=async()=>{
        const selected=candidates[Number(b.dataset.guidedReplace)].exercise;
        if(!await confirmSheet({title:'Replace '+e.name+'?',body:'Use '+selected.name+' in this plan. Previous history stays intact. Starting weights and references will not transfer. Review the new default sets, reps and RIR before saving.',ok:'Replace exercise'}))return;
        p.days[di].exercises[ei]=catalogExercise(selected,p.units);finish();
      });
    };
    host.querySelectorAll('input,select').forEach(el=>el.onchange=refresh);refresh();
  }catch(err){$('[data-guide-body]',panel.el).textContent='Library unavailable. Your plan is unchanged. '+err.message;}
}

function editExercise(root, di, ei, swap) {
  const p = lift.edit, day = p.days[di];
  if (ei === null && day.exercises.length >= 30) return toast('Up to 30 exercises per day.');
  const e = ei === null ? { name: '', sets: 3, rep_min: 8, rep_max: 12, target_rir: 2, equipment: 'barbell', increment: p.units === 'lb' ? 5 : 2.5, rest_seconds: null, notes: '' } : day.exercises[ei];
  const s = sheet(`<form class="lift-form"><h2 class="h2">${swap ? 'Swap exercise' : ei === null ? 'Add exercise' : 'Edit exercise'}</h2>
    ${field('Exercise name', 'name', swap ? '' : e.name, 'required maxlength="120"')}
    <button type="button" class="btn btn-line btn-block" data-browse-library>Choose from illustrated library</button><div data-exercise-library hidden></div>
    <div class="lift-fields">${field('Sets', 'sets', e.sets, 'type="number" min="1" max="20" required')}${field('Target RIR', 'target_rir', e.target_rir, 'type="number" min="0" max="10" step="0.5" required')}${field('Minimum reps', 'rep_min', e.rep_min, 'type="number" min="1" max="100" required')}${field('Maximum reps', 'rep_max', e.rep_max, 'type="number" min="1" max="100" required')}</div>
    <label class="lift-field"><span>Equipment</span><select name="equipment">${EQUIPMENT.map((v) => `<option ${v === e.equipment ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="lift-field"><span>Load type</span><select name="load_type">${['external','bodyweight','added','assisted','unknown'].map(v=>`<option ${loadType(e)===v?'selected':''}>${v}</option>`).join('')}</select></label>${field('Equipment identity (keep different machines separate)','apparatus',e.details?.apparatus??e.name,'maxlength="120"')}${field('Superset group (same label pairs exercises)','superset_group',e.details?.superset_group??'','maxlength="40"')}
    <label class="lift-field"><span>Rest policy when seconds are blank</span><select name="rest_policy"><option value="default">Plan default</option><option value="auto" ${e.details?.rest_policy==='auto'?'selected':''}>Suggested by movement and effort</option></select></label><div class="lift-fields">${field(`Increment (${p.units})`, 'increment', e.increment, 'type="number" min="0.001" max="500" step="any" required')}${field('Rest seconds (blank = default)', 'rest_seconds', e.rest_seconds ?? '', 'type="number" min="0" max="3600"')}</div>
    ${(swap?[]:e.details?.references??[]).length ? `<details><summary>Starting references · never History</summary><p class="small">Reference units stay as originally supplied. Qualifiers are explicit. Changes affect suggestions only.</p>${e.details.references.map((r,i)=>`<div class="lift-fields">${field(`Reference ${i+1} load (${r.units})`,`ref-weight-${i}`,r.weight??'','type="number" min="0" max="5000" step="any"')}${field(`Reference ${i+1} reps`,`ref-reps-${i}`,r.reps,'type="number" min="1" max="1000" required')}${field(`Reference ${i+1} RIR`,`ref-rir-${i}`,r.rir,'type="number" min="0" max="10" step="any" required')}<label class="lift-field"><span>RIR meaning</span><select name="ref-qualifier-${i}"><option value="exact" ${r.rir_qualifier!=='at_least'?'selected':''}>Exact</option><option value="at_least" ${r.rir_qualifier==='at_least'?'selected':''}>At least (+)</option></select></label></div>`).join('')}</details>` : ''}
    <label class="lift-field"><span>Exercise notes</span><textarea name="notes" maxlength="1000" rows="2">${esc(swap ? '' : e.notes)}</textarea></label><button type="submit" class="btn btn-me btn-block">Keep change</button></form>`);
  let selectedMeta=swap?{}:structuredClone(e.details??{});
  $('[data-browse-library]', s.el).onclick = () => {
    const host = $('[data-exercise-library]',s.el); host.hidden = !host.hidden;
    if (!host.hidden) mountLibrary(host, selected => {
      $('[name=name]',s.el).value = selected.name;
      const mapped=catalogExercise(selected,p.units);
      selectedMeta={...selectedMeta,...mapped.details};
      $('[name=equipment]',s.el).value = mapped.equipment;
      $('[name=load_type]',s.el).value = mapped.details.load_type;
      $('[name=apparatus]',s.el).value = mapped.name;
      host.hidden = true;
      $('[name=name]',s.el).focus();
    });
  };
  $('form', s.el).onsubmit = (event) => {
    event.preventDefault();
    const f = new FormData(event.target), min = Number(f.get('rep_min')), max = Number(f.get('rep_max'));
    if (max < min) return toast('Maximum reps must be at least minimum reps.', { error: true });
    const next = { id: ei === null || swap ? crypto.randomUUID() : e.id, name: String(f.get('name')).trim(),
      sets: Number(f.get('sets')), rep_min: min, rep_max: max, target_rir: Number(f.get('target_rir')), equipment: f.get('equipment'), increment: Number(f.get('increment')),
      rest_seconds: f.get('rest_seconds') === '' ? null : Number(f.get('rest_seconds')), notes: String(f.get('notes')), details:{...selectedMeta,rest_policy:f.get('rest_policy')??'default',load_type:f.get('load_type'),apparatus:String(f.get('apparatus')),superset_group:String(f.get('superset_group'))||null} };
    if (!next.name) return;
    if (!swap && next.details.references?.length) next.details.references=next.details.references.map((r,i)=>({...r,weight:f.get(`ref-weight-${i}`)===''?null:Number(f.get(`ref-weight-${i}`)),reps:Number(f.get(`ref-reps-${i}`)),rir:Number(f.get(`ref-rir-${i}`)),rir_qualifier:f.get(`ref-qualifier-${i}`)}));
    if (ei === null) day.exercises.push(next); else day.exercises[ei] = next;
    try { keepEdit(); s.close(); renderPlan(root); } catch (err) { toast(liftError(err), { error: true }); }
  };
}

function chart(rows, units) {
  if (!rows.length) return '';
  const equipmentKinds=new Set(rows.flatMap(s=>s.sets.filter(x=>!x.is_warmup).map(x=>`${x.details?.apparatus??''}|${x.details?.load_type??'external'}`)));
  if(equipmentKinds.size>1)return '<p class="small">This history contains different apparatus or load types. A combined strength trend would be misleading; review the individual set snapshots.</p>';
  const points = [...rows].reverse().map((s) => ({ ...safeMetrics(s.sets.map((x) => ({ ...x, weight: convertWeight(x.weight, s.units, units) }))), day: s.day }));
  const max = Math.max(1, ...points.map((p) => Math.max(p.e1rm??0, p.top??0)));
  if(points.every(p=>p.e1rm==null&&p.top==null))return '<p class="small">No comparable external-load estimates for this exercise. Bodyweight, assistance and unknown loads are excluded.</p>';
  const x = (i) => points.length === 1 ? 160 : 30 + i / (points.length - 1) * 270;
  const y = (v) => 145 - v / max * 115;
  return `<figure class="lift-chart"><figcaption>Estimated 1RM (Epley + exact RIR, compound free weights only) <span>—</span> · Top set <span class="top-line">—</span> (${units})</figcaption><svg viewBox="0 0 330 175" role="img" aria-label="Estimated one rep max and top set weight over ${points.length} sessions">
    <path d="M30 20V145H310" class="axis"/><text x="2" y="23">${n(max)}</text><text x="8" y="149">0</text>
    ${['e1rm', 'top'].map((key) => `<polyline class="${key === 'top' ? 'top-line' : ''}" points="${points.map((p, i) => p[key]==null?'':`${x(i)},${y(p[key])}`).filter(Boolean).join(' ')}"/>${points.map((p, i) => p[key]==null?'':`<circle class="${key === 'top' ? 'top-line' : ''}" cx="${x(i)}" cy="${y(p[key])}" r="3"><title>${esc(p.day)}: ${n(p[key])} ${units}</title></circle>`).join('')}`).join('')}
    <text x="30" y="168">${esc(points[0].day.slice(5))}</text><text x="270" y="168">${esc(points[points.length - 1].day.slice(5))}</text></svg></figure>`;
}
function renderHistory(root) {
  const content = $('[data-lift-content]', root);
  content.innerHTML = `<label class="lift-field"><span>Exercise history</span><select data-history-ex><option value="">All workouts</option>${lift.state.catalog.map((e) => `<option value="${e.id}" ${e.id === historyExercise ? 'selected' : ''}>${esc(e.name)}${e.archived ? ' (archived)' : ''}</option>`).join('')}</select></label><div data-history-body></div>`;
  historyRows = []; historyNext = null;
  $('[data-history-ex]', root).onchange = (ev) => { historyExercise = ev.target.value; historyRows = []; historyNext = null; fetchHistory(root, false); };
  fetchHistory(root, false);
}
async function fetchHistory(root, append) {
  const body = $('[data-history-body]', root), token = ++historyToken;
  if (!append) body.innerHTML = '<p class="body" role="status">Loading history…</p>';
  try {
    const result = await store.api('lift_history', { exercise_id: historyExercise || null, cursor: append ? historyNext : null });
    if (!root.isConnected || token !== historyToken) return;
    historyRows = append ? [...historyRows, ...result.items] : result.items; historyNext = result.next;
    const units = lift.state.plan.units;
    body.innerHTML = `<p class="small">External-load volume excludes unknown total bodyweight, added load and assistance. e1RM uses Epley with exact RIR only for mapped compound free weights (≤12 reps, ≤4 RIR); it is an estimate, not a tested max.</p>${historyExercise ? chart(historyRows, units) : ''}${historyRows.length ? historyRows.map((s) => {
      const metrics = safeMetrics(s.sets.map((x) => ({ ...x, weight: convertWeight(x.weight, s.units, units) })));
      return `<article class="card card-pad lift-exercise"><span class="eyebrow">${esc(fmtShort(s.day))}</span><h3 class="h3">${esc(s.day_name)}</h3><p class="small">${s.details?.duration_seconds!=null?`${Math.round(s.details.duration_seconds/60)} active minutes`:'Duration not recorded'}${s.details?.fatigue!=null?` · Fatigue ${s.details.fatigue}/5`:''}${s.details?.block?.name?' · Block '+esc(s.details.block.name):''}</p><p class="small">${historyExercise ? 'Exercise' : 'Workout'} volume ${n(metrics.volume)} ${units} · e1RM ${metrics.e1rm==null?'not estimated':n(metrics.e1rm)+' '+units} · Top ${metrics.top==null?'not comparable':n(metrics.top)+' '+units}</p>
        <details><summary>Sets and notes</summary>${s.sets.map((x) => `<p class="small">${esc(x.exercise_name)} · ${x.is_warmup ? 'Warm-up' : `Set ${x.set_no}`} · ${n(x.weight)} ${s.units} × ${x.reps} @ ${rirText(x)} RIR · ${esc(loadLabel(x.details?.load_type??'external',s.units))}${x.details?.kind==='drop'?' · Drop set':''}${x.exercise_notes ? `<br>${esc(x.exercise_notes)}` : ''}</p>`).join('')}<p class="body">${esc(s.notes)}</p></details>${button('Delete workout', `data-delete-session="${s.id}"`, 'btn-ghost')}</article>`;
    }).join('') : '<p class="body">Your finished workouts will appear here.</p>'}${historyNext ? button('Load more', 'data-more', 'btn-line btn-block') : ''}`;
    body.onclick = async (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-more')) { b.disabled = true; return fetchHistory(root, true); }
      if (b.dataset.deleteSession && await confirmSheet({ title: 'Delete this workout?', body: 'This deletes the whole saved session, including all exercises. Your 75 Hard checkboxes stay as they are.', ok: 'Delete workout', danger: true })) {
        b.disabled = true;
        try { await store.api('lift_session_delete', { id: b.dataset.deleteSession }); await loadLift(); await fetchHistory(root, false); }
        catch (err) { b.disabled = false; toast(liftError(err), { error: true }); }
      }
    };
  } catch (err) {
    if (token !== historyToken || !root.isConnected) return;
    if (!append) body.innerHTML = `<p class="body">${esc(liftError(err))}</p>${button('Retry history', 'data-retry-history')}`;
    else toast(liftError(err), { error: true });
    const retry = $('[data-retry-history]', body) ?? $('[data-more]', body);
    if (retry) { retry.disabled = false; retry.onclick = () => fetchHistory(root, append); }
  }
}

export async function renderLiftSettings(root) {
  root.innerHTML = '<span class="eyebrow">Lift</span><p class="small">Loading your lifting settings…</p>';
  try {
    await loadLift(); if (!root.isConnected) return;
    const p = structuredClone(lift.state.plan), days = structuredClone(lift.state.days);
    root.innerHTML = `<span class="eyebrow">Lift · only you</span><form class="card card-pad lift-form"><label class="lift-field"><span>Weight units</span><select name="units"><option value="lb" ${p.units === 'lb' ? 'selected' : ''}>Pounds (lb)</option><option value="kg" ${p.units === 'kg' ? 'selected' : ''}>Kilograms (kg)</option></select></label>
      <div class="lift-fields">${field('Bar weight', 'bar_weight', p.bar_weight, 'type="number" min="0" max="500" step="any" required')}${field('Default rest (seconds)', 'default_rest_seconds', p.default_rest_seconds, 'type="number" min="0" max="3600" required')}</div>
      ${field('Available plate sizes (comma separated)', 'plates', p.plates.join(', '), 'required')}
      <p class="small">Plate sizes assume matching pairs. Unit changes convert your equipment and increments; finished workouts keep their original units. Applies to your next workout.</p>
      ${lift.edit?._dirty ? '<p class="lift-notice">You have a plan draft in Lift. Save or reload that plan before changing these settings.</p>' : ''}
      <button type="submit" class="btn btn-me btn-block" ${lift.edit?._dirty ? 'disabled' : ''}>Save Lift settings</button></form>`;
    let displayedUnits = p.units;
    $('[name=units]', root).onchange = (ev) => {
      const next = ev.target.value, bar = $('[name=bar_weight]', root), plates = $('[name=plates]', root);
      bar.value = clean(convertWeight(Number(bar.value), displayedUnits, next));
      plates.value = plates.value.split(',').map((x) => Number(convertWeight(Number(x.trim()), displayedUnits, next).toFixed(3))).join(', ');
      displayedUnits = next;
    };
    $('form', root).onsubmit = async (ev) => {
      ev.preventDefault(); const form = ev.target, f = new FormData(form), units = f.get('units');
      const plates = String(f.get('plates')).split(',').map((x) => Number(x.trim()));
      if (!plates.length || plates.length > 16 || plates.some((v) => !Number.isFinite(v) || v <= 0 || v > 500 || Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6)) return toast('Enter plate sizes above 0, with up to three decimal places.', { error: true });
      const next = { ...p, days: structuredClone(days), units, plates, bar_weight: Number(f.get('bar_weight')), default_rest_seconds: Number(f.get('default_rest_seconds')) };
      next.days.forEach((d) => d.exercises.forEach((e) => e.increment = convertWeight(e.increment, p.units, units)));
      const b = $('button[type=submit]', form); b.disabled = true;
      try { await savePlan(next); toast('Lift settings saved.'); renderLiftSettings(root); }
      catch (err) { b.disabled = false; toast(liftError(err), { error: true, ms: 7000 }); }
    };
  } catch (err) { if (root.isConnected) root.innerHTML = `<span class="eyebrow">Lift</span><p class="small">${esc(liftError(err))}</p>`; }
}

function renumber(exercise) {
  let warm=0,work=0;
  exercise.logged.forEach(s=>s.set_no=s.is_warmup?++warm:++work);
}
function editActiveExercise(e,done) {
  const s=sheet(`<form class="lift-form"><h2 class="h2">Workout-only exercise edit</h2><p class="small">Your permanent plan is unchanged. Changing load semantics or equipment removes unsaved completed sets for this exercise after confirmation, so unlike loads do not share performance.</p>${field('Name','name',e.name,'required maxlength="120"')}<label class="lift-field"><span>Equipment</span><select name="equipment">${EQUIPMENT.map(v=>`<option ${e.equipment===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="lift-field"><span>Load type</span><select name="load_type">${['external','bodyweight','added','assisted','unknown'].map(v=>`<option ${loadType(e)===v?'selected':''}>${v}</option>`).join('')}</select></label>${field('Apparatus identity','apparatus',e.details?.apparatus??'','maxlength="120"')}${field('Superset group (same label pairs exercises)','group',e.details?.superset_group??'','maxlength="40"')}${field('Rest seconds (blank = default)','rest',e.rest_seconds??'','type="number" min="0" max="3600"')}<button class="btn btn-me btn-block" type="submit">Apply to this workout</button></form>`);
  $('form',s.el).onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),type=f.get('load_type'),equipment=f.get('equipment'),apparatus=String(f.get('apparatus'));const changed=type!==loadType(e)||equipment!==e.equipment||apparatus!==(e.details?.apparatus??'');if(changed&&e.logged.some(x=>x.completed)&&!await confirmSheet({title:'Reset this exercise’s unsaved sets?',body:'Load type or equipment changed. Completed sets will be unchecked and loads cleared for this exercise.',ok:'Apply and reset'}))return;try{e.name=String(f.get('name')).trim();e.rest_seconds=f.get('rest')===''?null:Number(f.get('rest'));e.details={...e.details,load_type:type,apparatus,superset_group:String(f.get('group')).trim()||null};e.equipment=equipment;if(changed){e.temporary=true;e.last=[];e.reason='Workout-only equipment/load change; enter new values.';e.logged.forEach(x=>{x.completed=false;x.weight=type==='bodyweight'?0:null;x.details={...x.details,load_type:type,equipment,apparatus};});}done();s.close();}catch(err){toast(err.message,{error:true});}};
}
