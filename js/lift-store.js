import { elapsedSeconds, togglePause, loadType } from './lift-domain.js';
import { timerState, adjustedDeadline } from './lift-timer.js';
import { store } from './store.js';
import { toast } from './util.js';

export const lift = { state: null, draft: null, edit: null, namespace: null, key: null, error: null, saving: false };
let initializing, sound, timerNode, lastAlarm = null;
const read = (name) => {
  const raw = localStorage.getItem(`${lift.namespace}:${name}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error('Saved Lift data could not be read. Keep this browser data and try again.'); }
};
export function persistLift(name, value) {
  if (!lift.namespace) throw new Error('Lift is still loading.');
  try {
    if (value === null) localStorage.removeItem(`${lift.namespace}:${name}`);
    else localStorage.setItem(`${lift.namespace}:${name}`, JSON.stringify(value));
  } catch { throw new Error('This device could not save your draft. Free some browser storage before continuing.'); }
}
export async function initLift() {
  if (lift.key === store.k && lift.namespace) return;
  if (initializing) return initializing;
  initializing = (async () => {
    // Isolate local drafts by the private link, even during the app's cached startup.
    const key = store.k;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const fingerprint = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    lift.namespace = `lift-v1:${fingerprint}`;
    lift.state = read('state'); lift.draft = read('draft'); lift.edit = read('edit');
    lift.key = key;
    tick();
  })();
  try { await initializing; } finally { initializing = null; }
}
export async function loadLift() {
  await initLift();
  try {
    const state = await store.api('lift_state');
    lift.state = state; lift.error = null;
    persistLift('state', state);
    // A clean editor must follow settings changes and refreshed server versions.
    // Keep unsaved edits so a conflict can be resolved without losing them.
    if (lift.edit && !lift.edit._dirty) { persistLift('edit', null); lift.edit = null; }
  } catch (err) {
    lift.error = liftError(err);
    if (!lift.state) throw err;
  }
  return lift.state;
}
export function saveDraft() { persistLift('draft', lift.draft); tick(); }
export async function savePlan(plan, { clearEdit = true } = {}) {
  const state = await store.api('lift_plan_save', { plan });
  lift.state = state; lift.error = null;
  persistLift('state', state);
  if (clearEdit) {
    if (lift.edit && !lift.edit._dirty) {
      // A library/settings sheet may save while a clean Plan screen is underneath.
      // Preserve that editor object's identity so its handlers use the new version.
      Object.assign(lift.edit, structuredClone(state.plan), {days:structuredClone(state.days),_dirty:false});
      persistLift('edit',lift.edit);
    } else { persistLift('edit', null); lift.edit = null; }
  }
  return state;
}
export async function finishLift() {
  if (lift.saving || !lift.draft) return null;
  lift.saving = true;
  try {
    const d = lift.draft;
    if (!d.finished_at) { if (d.paused_at) togglePause(d); d.duration_seconds = elapsedSeconds(d); d.finished_at = new Date().toISOString(); d.timer_end = null; saveDraft(); }
    const sets = d.exercises.flatMap((e) => e.logged.filter((s) => s.completed).map((s) => ({
      exercise_id: e.temporary ? null : e.id, exercise_name: e.name, exercise_notes: e.notes ?? '', set_no: s.set_no,
      is_warmup: s.is_warmup, weight: s.weight, reps: s.reps, rir: s.rir, details: { ...s.details, load_type: s.details?.load_type ?? loadType(e), equipment: e.equipment, mechanic:e.details?.mechanic??null, apparatus: e.details?.apparatus ?? '', catalog_id: e.details?.catalog_id ?? null, primaryMuscles:e.details?.primaryMuscles ?? [], secondaryMuscles:e.details?.secondaryMuscles ?? [], superset_group:e.details?.superset_group ?? null },
    })));
    const result = await store.api('lift_session_save', { session: {
      id: d.id, lift_day_id: d.lift_day_id, day_name: d.day_name, units: d.units,
      started_at: d.started_at, finished_at: d.finished_at, notes: d.notes ?? '', sets, details: { pause_seconds:d.pause_seconds ?? 0, duration_seconds:d.duration_seconds ?? 0, fatigue:d.fatigue ?? null, block:d.plan?.details?.block ?? null, program_id:d.plan?.details?.active_program??null, planned_sets:d.planned_sets ?? 0 },
    } });
    persistLift('draft', null); lift.draft = null; tick();
    // A refresh failure after the commit must not turn a successful save into a failed one.
    if (lift.state) { lift.state.last_day_id = d.lift_day_id; try { persistLift('state', lift.state); } catch { /* Session is confirmed and draft is cleared; cache is noncritical. */ } }
    return { ...result, day: d.day };
  } finally { lift.saving = false; }
}
export function liftError(err) {
  const messages = {
    offline: 'Offline. Your workout stays on this device. Retry Finish when connected.',
    lift_conflict: 'Your plan changed on another screen or device. Reload the saved plan before editing again.',
    lift_unavailable: 'Lift is not available on the server yet. Your 75 Hard tracker still works.',
    unknown_action: 'Lift is not available on the server yet. Your 75 Hard tracker still works.',
    lift_backup_invalid: 'This backup is invalid, incompatible, or belongs to another profile.',
    lift_invalid: 'Check the weights, reps, RIR and plan fields, then try again.',
    lift_empty: 'Complete at least one working set before finishing.',
    not_found: 'That workout or exercise is no longer available to your private link.',
    bad_key: 'Your private link is no longer valid. Your draft stays saved on this device.',
    lift_write_failed: 'The server could not save this. Your draft is still here; please retry.',
  };
  return messages[err?.code ?? err?.message] ?? err?.message ?? 'Could not load Lift. Please retry.';
}
export function unlockSound() {
  try {
    sound ??= new (window.AudioContext || window.webkitAudioContext)();
    if (sound.state === 'suspended') sound.resume().catch(() => {});
  } catch { /* The visual alert always works. */ }
}
function beep() {
  if (!sound || sound.state !== 'running') return;
  const oscillator = sound.createOscillator(), gain = sound.createGain();
  oscillator.connect(gain); gain.connect(sound.destination);
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.12, sound.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, sound.currentTime + 0.6);
  oscillator.start(); oscillator.stop(sound.currentTime + 0.6);
}
export function startRest(seconds, context=null) {
  if (!lift.draft || lift.draft.finished_at || lift.draft.paused_at) return;
  unlockSound(); lift.draft.timer_context=context; lift.draft.timer_alerted_end=null; lift.draft.timer_end = Date.now() + seconds * 1000; lastAlarm = null; saveDraft();
}
function tick() {
  const progress=document.querySelector?.('[data-workout-progress]');
  if(progress&&lift.draft){const sets=lift.draft.exercises.flatMap(e=>e.logged).filter(s=>!s.is_warmup);const label=`${sets.filter(s=>s.completed).length} / ${sets.length} working sets complete · ${Math.floor(elapsedSeconds(lift.draft)/60)} active minutes${lift.draft.paused_at?' · paused':''}`;if(progress.textContent!==label)progress.textContent=label;}
  const end = lift.draft?.timer_end;
  if (!end || lift.draft.finished_at) { timerNode?.remove(); timerNode = null; return; }
  if (!timerNode) {
    timerNode = document.createElement('aside'); timerNode.className = 'lift-timer';
    timerNode.setAttribute('aria-label', 'Rest timer');
    timerNode.innerHTML = '<span data-rest-time></span><button data-rest-change="-15" aria-label="Subtract 15 seconds">−15s</button><button data-rest-change="15" aria-label="Add 15 seconds">+15s</button><button data-rest-close aria-label="Dismiss rest timer">×</button>';
    timerNode.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b || !lift.draft) return;
      unlockSound();
      if (b.hasAttribute('data-rest-close')) lift.draft.timer_end = null;
      else { lift.draft.timer_end = adjustedDeadline(lift.draft.timer_end, Number(b.dataset.restChange)); lastAlarm = null; }
      try { saveDraft(); } catch (err) { toast(liftError(err), { error: true }); }
    });
    document.body.appendChild(timerNode);
  }
  const state = timerState(end);
  timerNode.querySelector('[data-rest-time]').textContent = `${lift.draft.timer_context?.label?lift.draft.timer_context.label+' · ':''}${state.label}`;
  timerNode.classList.toggle('done', state.expired);
  if (state.expired && lastAlarm !== end && lift.draft.timer_alerted_end !== end && document.visibilityState === 'visible') {
    lastAlarm = end; lift.draft.timer_alerted_end = end;
    try { persistLift('draft', lift.draft); } catch { /* Keep the visual timer usable if storage is full. */ }
    try { beep(); } catch { /* Audio failure must never suppress visible completion feedback. */ }
    try { navigator.vibrate?.([150, 80, 150]); } catch { /* Not supported on every phone. */ }
    toast('Rest complete. Ready for your next set.', { ms: 5000 });
  }
}
// The clock only paints. The persisted end timestamp is the source of truth.
setInterval(tick, 500);
document.addEventListener('visibilitychange', tick);

// iOS keeps the layout viewport behind its keyboard. Reserve the visible area
// only while editing Lift, including its existing bottom sheets.
function fitLiftKeyboard() {
  const viewport = window.visualViewport, active = document.activeElement;
  const editing = active?.matches('input, textarea, select') && active.closest('.lift-view, .lift-field, .lift-form');
  const covered = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  const open = !!editing && covered > 120;
  document.body.classList.toggle('lift-keyboard', open);
  document.documentElement.style.setProperty('--lift-keyboard-bottom', `${open ? covered : 0}px`);
  document.documentElement.style.setProperty('--lift-visible-height', `${viewport?.height ?? window.innerHeight}px`);
  if (open && active.closest('.lift-view')) {
    const rect = active.getBoundingClientRect();
    if (rect.bottom > viewport.offsetTop + viewport.height - 16 || rect.top < viewport.offsetTop + 16) active.scrollIntoView({ block: 'center' });
  }
}
window.visualViewport?.addEventListener('resize', fitLiftKeyboard);
window.visualViewport?.addEventListener('scroll', fitLiftKeyboard);
document.addEventListener('focusin', fitLiftKeyboard);
document.addEventListener('focusout', () => requestAnimationFrame(fitLiftKeyboard));
