import { store } from '../store.js';
import { icon } from '../icons.js';
import { $, esc, sheet, confirmSheet, toast, fmtShort } from '../util.js';
import { lift, loadLift, savePlan, persistLift, saveDraft, finishLift, liftError, startRest, unlockSound } from '../lift-store.js';
import { suggest, warmups, plateMath, sessionMetrics, convertWeight, clean } from '../lift-rules.js';

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
  return `<header class="page-head"><span class="eyebrow">Your training · ${esc(store.me.name)}</span><h1 class="h1">Lift</h1>
    <p class="small">${icon('lock')} Your plan. Your numbers. Only you.</p></header>
    <nav class="lift-nav" aria-label="Lift screens">${[['home', 'Workout'], ['plan', 'Plan'], ['history', 'History']].map(([id, label]) => button(label, `data-screen="${id}" aria-pressed="${screen === id}"`, screen === id ? 'btn-me' : 'btn-line')).join('')}</nav>`;
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
    const b = ev.target.closest('[data-screen]');
    if (!b) return;
    screen = b.dataset.screen; paint(root);
  };
  if (screen === 'plan') renderPlan(root);
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
    <section class="section"><span class="eyebrow">Your days</span><div class="group">${days.map((d) => `<button class="row" data-start="${d.id}" ${d.exercises.length ? '' : 'disabled'}><span class="row-ico">${icon('workout')}</span><span class="txt"><span class="t">${esc(d.name)}</span><span class="d">${d.exercises.length} exercises</span></span><span class="end">Start ${icon('chevR')}</span></button>`).join('')}</div></section>`
    : `<section class="card card-pad"><span class="eyebrow">A fresh start</span><h2 class="h2">Build your first workout</h2><p class="body">Add a day, choose your exercises, and make it yours.</p>${button('Create my plan', 'data-edit-plan', 'btn-me btn-block')}</section>`;
  content.onclick = (ev) => {
    if (ev.target.closest('[data-edit-plan]')) { screen = 'plan'; return paint(root); }
    const b = ev.target.closest('[data-start]'); if (!b) return;
    const selected = days.find((d) => d.id === b.dataset.start);
    if (!selected?.exercises.length) return;
    const plan = lift.state.plan;
    lift.draft = { id: crypto.randomUUID(), lift_day_id: selected.id, day_name: selected.name, units: plan.units,
      day: localDay(), started_at: new Date().toISOString(), finished_at: null, notes: '', timer_end: null, plan: structuredClone(plan),
      exercises: selected.exercises.map((e) => {
        const recommendation = suggest(e, lift.state.recent[e.id], plan.units);
        return { ...structuredClone(e), reason: recommendation.reason, last: recommendation.last,
          logged: recommendation.sets.map((s, i) => ({ ...s, weight: Number(s.weight.toFixed(2)), set_no: i + 1, is_warmup: false, completed: false })) };
      }) };
    try { saveDraft(); unlockSound(); paint(root); } catch (err) { lift.draft = null; toast(liftError(err), { error: true }); }
  };
}
function renderActive(root) {
  const d = lift.draft, content = $('[data-lift-content]', root), frozen = !!d.finished_at;
  content.innerHTML = `<div class="lift-session-head"><div><span class="eyebrow">${frozen ? 'Waiting to save' : 'In progress'}</span><h2 class="h2">${esc(d.day_name)}</h2><p class="small">${esc(fmtShort(d.day))} · ${d.units} · Saved on this device</p></div>${button('Discard', 'data-discard', 'btn-ghost')}</div>
    ${frozen ? '<p class="lift-notice">Workout complete. Your draft stays here until the server confirms it. Retry Finish when connected.</p>' : ''}
    ${d.exercises.map((e, ei) => `<section class="card card-pad lift-exercise"><div class="lift-exercise-head"><div><span class="eyebrow">${ei + 1} / ${d.exercises.length}</span><h3 class="h3">${esc(e.name)}</h3></div><span class="pill">${e.rep_min}–${e.rep_max} reps · ${e.target_rir} RIR</span></div>
      <p class="small lift-reason">${esc(e.reason)}</p><p class="small">Last: ${e.last.length ? e.last.map((s) => `${n(s.weight)} × ${s.reps} @ ${s.rir} RIR`).join(' · ') : 'No previous session'}</p>
      <div class="lift-set-labels" aria-hidden="true"><span>Set</span><span>${d.units}</span><span>Reps</span><span>RIR</span><span>Done</span></div>
      ${e.logged.map((s, si) => `<div class="lift-set ${s.completed ? 'complete' : ''}" data-set-row="${ei}:${si}"><span class="small">${s.is_warmup ? 'W' : s.set_no}</span>
        ${['weight', 'reps', 'rir'].map((key) => `<input type="number" inputmode="${key === 'reps' ? 'numeric' : 'decimal'}" min="${key === 'reps' ? 1 : 0}" max="${key === 'weight' ? 5000 : key === 'reps' ? 1000 : 10}" step="${key === 'reps' ? 1 : 'any'}" value="${s[key]}" aria-label="${esc(e.name)} ${s.is_warmup ? 'warm-up' : 'set'} ${s.set_no} ${key}" data-value="${ei}:${si}:${key}" ${frozen ? 'disabled' : ''}>`).join('')}
        <button class="lift-complete" data-complete="${ei}:${si}" aria-label="Complete ${esc(e.name)} ${s.is_warmup ? 'warm-up' : 'set'} ${s.set_no}" aria-pressed="${s.completed}" ${frozen ? 'disabled' : ''}>${icon('check')}</button></div>`).join('')}
      <div class="lift-actions">${button('Warm-ups', `data-warm="${ei}" ${frozen || e.logged.some((s) => s.is_warmup) ? 'disabled' : ''}`)}${e.equipment === 'barbell' ? button('Plates', `data-plates="${ei}"`) : ''}</div>
      <label class="lift-field"><span>Exercise notes</span><textarea rows="2" maxlength="1000" data-notes="${ei}" ${frozen ? 'disabled' : ''}>${esc(e.notes)}</textarea></label></section>`).join('')}
    <label class="lift-field"><span>Workout notes</span><textarea rows="2" maxlength="2000" data-session-notes ${frozen ? 'disabled' : ''}>${esc(d.notes)}</textarea></label>
    <button class="btn btn-me btn-block lift-finish" data-finish>${frozen ? 'Retry Finish' : 'Finish workout'}</button>`;
  content.oninput = (ev) => {
    const t = ev.target;
    if (t.dataset.value) {
      const [ei, si, key] = t.dataset.value.split(':'); d.exercises[ei].logged[si][key] = t.value === '' ? null : Number(t.value);
    } else if (t.dataset.notes !== undefined) d.exercises[t.dataset.notes].notes = t.value;
    else if (t.hasAttribute('data-session-notes')) d.notes = t.value;
    try { saveDraft(); } catch (err) { toast(liftError(err), { error: true, ms: 7000 }); }
  };
  content.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if (b.hasAttribute('data-discard')) {
        if (!await confirmSheet({ title: 'Discard this draft?', body: 'Unsaved sets on this device will be removed. A workout already saved on the server stays in History.', ok: 'Discard', danger: true })) return;
        persistLift('draft', null); lift.draft = null; saveDraft(); return paint(root);
      }
      if (b.dataset.complete) {
        const [ei, si] = b.dataset.complete.split(':'); const e = d.exercises[ei], s = e.logged[si];
        const row = b.closest('[data-set-row]');
        if ([...row.querySelectorAll('input')].some((i) => i.value === '' || !i.reportValidity())) return;
        s.completed = !s.completed; saveDraft();
        b.setAttribute('aria-pressed', String(s.completed)); row.classList.toggle('complete', s.completed);
        if (s.completed) startRest(e.rest_seconds ?? d.plan.default_rest_seconds);
      }
      if (b.dataset.warm !== undefined) {
        const e = d.exercises[b.dataset.warm], weight = e.logged.find((s) => !s.is_warmup)?.weight ?? 0;
        const ramp = warmups(weight, e, d.plan).map((s, i) => ({ ...s, set_no: i + 1 }));
        if (!ramp.length) return toast('Set a working weight above your warm-up load first.');
        e.logged.unshift(...ramp); saveDraft(); paint(root);
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
        await loadLift(); paint(root); await offerCredit(result.day);
      }
    } catch (err) { toast(liftError(err), { error: true, ms: 6000 }); if (lift.draft?.finished_at) paint(root); }
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
        ${button('Edit', `data-ex-edit="${di}:${ei}"`)}${button('Swap', `data-ex-swap="${di}:${ei}"`)}${button('↑', `data-ex-move="${di}:${ei}:-1" aria-label="Move ${esc(e.name)} up" ${ei === 0 ? 'disabled' : ''}`)}${button('↓', `data-ex-move="${di}:${ei}:1" aria-label="Move ${esc(e.name)} down" ${ei === d.exercises.length - 1 ? 'disabled' : ''}`)}${button('Delete', `data-ex-delete="${di}:${ei}"`, 'btn-ghost')}</div></div>`).join('')}
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
function editExercise(root, di, ei, swap) {
  const p = lift.edit, day = p.days[di];
  if (ei === null && day.exercises.length >= 30) return toast('Up to 30 exercises per day.');
  const e = ei === null ? { name: '', sets: 3, rep_min: 8, rep_max: 12, target_rir: 2, equipment: 'barbell', increment: p.units === 'lb' ? 5 : 2.5, rest_seconds: null, notes: '' } : day.exercises[ei];
  const s = sheet(`<form class="lift-form"><h2 class="h2">${swap ? 'Swap exercise' : ei === null ? 'Add exercise' : 'Edit exercise'}</h2>
    ${field('Exercise name', 'name', swap ? '' : e.name, 'required maxlength="120"')}
    <div class="lift-fields">${field('Sets', 'sets', e.sets, 'type="number" min="1" max="20" required')}${field('Target RIR', 'target_rir', e.target_rir, 'type="number" min="0" max="10" step="0.5" required')}${field('Minimum reps', 'rep_min', e.rep_min, 'type="number" min="1" max="100" required')}${field('Maximum reps', 'rep_max', e.rep_max, 'type="number" min="1" max="100" required')}</div>
    <label class="lift-field"><span>Equipment</span><select name="equipment">${['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'].map((v) => `<option ${v === e.equipment ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="lift-fields">${field(`Increment (${p.units})`, 'increment', e.increment, 'type="number" min="0.001" max="500" step="any" required')}${field('Rest seconds (blank = default)', 'rest_seconds', e.rest_seconds ?? '', 'type="number" min="0" max="3600"')}</div>
    <label class="lift-field"><span>Exercise notes</span><textarea name="notes" maxlength="1000" rows="2">${esc(swap ? '' : e.notes)}</textarea></label><button type="submit" class="btn btn-me btn-block">Keep change</button></form>`);
  $('form', s.el).onsubmit = (event) => {
    event.preventDefault();
    const f = new FormData(event.target), min = Number(f.get('rep_min')), max = Number(f.get('rep_max'));
    if (max < min) return toast('Maximum reps must be at least minimum reps.', { error: true });
    const next = { id: ei === null || swap ? crypto.randomUUID() : e.id, name: String(f.get('name')).trim(),
      sets: Number(f.get('sets')), rep_min: min, rep_max: max, target_rir: Number(f.get('target_rir')), equipment: f.get('equipment'), increment: Number(f.get('increment')),
      rest_seconds: f.get('rest_seconds') === '' ? null : Number(f.get('rest_seconds')), notes: String(f.get('notes')) };
    if (!next.name) return;
    if (ei === null) day.exercises.push(next); else day.exercises[ei] = next;
    try { keepEdit(); s.close(); renderPlan(root); } catch (err) { toast(liftError(err), { error: true }); }
  };
}

function chart(rows, units) {
  if (!rows.length) return '';
  const points = [...rows].reverse().map((s) => ({ ...sessionMetrics(s.sets.map((x) => ({ ...x, weight: convertWeight(x.weight, s.units, units) }))), day: s.day }));
  const max = Math.max(1, ...points.map((p) => Math.max(p.e1rm, p.top)));
  const x = (i) => points.length === 1 ? 160 : 30 + i / (points.length - 1) * 270;
  const y = (v) => 145 - v / max * 115;
  return `<figure class="lift-chart"><figcaption>Estimated 1RM <span>—</span> · Top set <span class="top-line">—</span> (${units})</figcaption><svg viewBox="0 0 330 175" role="img" aria-label="Estimated one rep max and top set weight over ${points.length} sessions">
    <path d="M30 20V145H310" class="axis"/><text x="2" y="23">${n(max)}</text><text x="8" y="149">0</text>
    ${['e1rm', 'top'].map((key) => `<polyline class="${key === 'top' ? 'top-line' : ''}" points="${points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')}"/>${points.map((p, i) => `<circle class="${key === 'top' ? 'top-line' : ''}" cx="${x(i)}" cy="${y(p[key])}" r="3"><title>${esc(p.day)}: ${n(p[key])} ${units}</title></circle>`).join('')}`).join('')}
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
    body.innerHTML = `${historyExercise ? chart(historyRows, units) : ''}${historyRows.length ? historyRows.map((s) => {
      const metrics = sessionMetrics(s.sets.map((x) => ({ ...x, weight: convertWeight(x.weight, s.units, units) })));
      return `<article class="card card-pad lift-exercise"><span class="eyebrow">${esc(fmtShort(s.day))}</span><h3 class="h3">${esc(s.day_name)}</h3><p class="small">${historyExercise ? 'Exercise' : 'Workout'} volume ${n(metrics.volume)} ${units} · e1RM ${n(metrics.e1rm)} ${units} · Top ${n(metrics.top)} ${units}</p>
        <details><summary>Sets and notes</summary>${s.sets.map((x) => `<p class="small">${esc(x.exercise_name)} · ${x.is_warmup ? 'Warm-up' : `Set ${x.set_no}`} · ${n(x.weight)} ${s.units} × ${x.reps} @ ${x.rir} RIR${x.exercise_notes ? `<br>${esc(x.exercise_notes)}` : ''}</p>`).join('')}<p class="body">${esc(s.notes)}</p></details>${button('Delete workout', `data-delete-session="${s.id}"`, 'btn-ghost')}</article>`;
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
