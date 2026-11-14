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
  if (clearEdit) { persistLift('edit', null); lift.edit = null; }
  return state;
}
export async function finishLift() {
  if (lift.saving || !lift.draft) return null;
  lift.saving = true;
  try {
    const d = lift.draft;
    if (!d.finished_at) { d.finished_at = new Date().toISOString(); d.timer_end = null; saveDraft(); }
    const sets = d.exercises.flatMap((e) => e.logged.filter((s) => s.completed).map((s) => ({
      exercise_id: e.id, exercise_name: e.name, exercise_notes: e.notes ?? '', set_no: s.set_no,
      is_warmup: s.is_warmup, weight: s.weight, reps: s.reps, rir: s.rir,
    })));
    const result = await store.api('lift_session_save', { session: {
      id: d.id, lift_day_id: d.lift_day_id, day_name: d.day_name, units: d.units,
      started_at: d.started_at, finished_at: d.finished_at, notes: d.notes ?? '', sets,
    } });
    persistLift('draft', null); lift.draft = null; tick();
    // A refresh failure after the commit must not turn a successful save into a failed one.
    if (lift.state) { lift.state.last_day_id = d.lift_day_id; persistLift('state', lift.state); }
    return { ...result, day: d.day };
  } finally { lift.saving = false; }
}
export function liftError(err) {
  const messages = {
    offline: 'Offline. Your workout stays on this device. Retry Finish when connected.',
    lift_conflict: 'Your plan changed on another screen or device. Reload the saved plan before editing again.',
    lift_unavailable: 'Lift is not available on the server yet. Your 75 Hard tracker still works.',
    unknown_action: 'Lift is not available on the server yet. Your 75 Hard tracker still works.',
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
export function startRest(seconds) {
  if (!lift.draft || lift.draft.finished_at) return;
  unlockSound(); lift.draft.timer_end = Date.now() + seconds * 1000; lastAlarm = null; saveDraft();
}
function tick() {
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
      else { lift.draft.timer_end = Math.max(Date.now(), lift.draft.timer_end) + Number(b.dataset.restChange) * 1000; lastAlarm = null; }
      try { saveDraft(); } catch (err) { toast(liftError(err), { error: true }); }
    });
    document.body.appendChild(timerNode);
  }
  const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  timerNode.querySelector('[data-rest-time]').textContent = seconds ? `Rest ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Rest complete';
  timerNode.classList.toggle('done', !seconds);
  if (!seconds && lastAlarm !== end && document.visibilityState === 'visible') {
    lastAlarm = end; beep(); toast('Rest complete. Ready for your next set.', { ms: 5000 });
  }
}
// The clock only paints. The persisted end timestamp is the source of truth.
setInterval(tick, 500);
document.addEventListener('visibilitychange', tick);
