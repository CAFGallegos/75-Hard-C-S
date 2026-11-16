import assert from 'node:assert/strict';

// Exercise actual storage/write behavior with browser globals, without a backend.
const memory = new Map(), events = new Map(), classes = new Set(), styles = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
globalThis.document = {
  addEventListener: (name, fn) => events.set(name, fn),
  documentElement: { style: { setProperty: (k, v) => styles.set(k, v) } },
  body: { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } },
};
globalThis.window = { innerHeight: 844, visualViewport: { height: 844, offsetTop: 0, addEventListener: (name, fn) => events.set(`viewport:${name}`, fn) } };
globalThis.requestAnimationFrame = (fn) => fn();
const realInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;
const { store } = await import('../js/store.js');
const { lift, loadLift, finishLift } = await import('../js/lift-store.js');
globalThis.setInterval = realInterval;
store.k = 'sample-a';
store.api = async () => ({ plan: { units: 'kg', version: 2 }, days: [] });
await loadLift();
lift.edit = { _dirty: false, units: 'lb', version: 1 };
await loadLift();
assert.equal(lift.edit, null, 'clean editor follows new settings');
lift.edit = { _dirty: true, days: [{ name: 'Unsaved day' }] };
await loadLift();
assert.equal(lift.edit.days[0].name, 'Unsaved day', 'refresh preserves unsaved edits');
lift.draft = { id: 'retry-id', day: '2026-11-14', exercises: [{ id: 'exercise', name: 'Press', logged: [{ completed: true, set_no: 1, is_warmup: false, weight: 45, reps: 8, rir: 2 }] }] };
const calls = [];
store.api = async (_action, params) => { calls.push(structuredClone(params)); throw Object.assign(new Error('offline'), { code: 'offline' }); };
await assert.rejects(finishLift(), /offline/);
assert.ok(lift.draft.finished_at);
assert.equal(lift.saving, false);
await assert.rejects(finishLift(), /offline/);
assert.deepEqual(calls[0], calls[1], 'retry retains session UUID and finish timestamp');
store.api = async () => ({ saved: true });
await finishLift();
assert.equal(lift.draft, null);
assert.equal(memory.has(`${lift.namespace}:draft`), false);

let scrolled = false;
document.activeElement = { matches: () => true, closest: () => true, getBoundingClientRect: () => ({ top: 700, bottom: 748 }), scrollIntoView: () => scrolled = true };
window.visualViewport.height = 500;
events.get('viewport:resize')();
assert.ok(classes.has('lift-keyboard'));
assert.equal(styles.get('--lift-keyboard-bottom'), '344px');
assert.ok(scrolled, 'covered input scrolls into the visible viewport');
document.activeElement = null;
events.get('focusout')();
assert.ok(!classes.has('lift-keyboard'));
console.log('ok  Lift clean/dirty editor refresh, offline Finish identity, draft cleanup and keyboard viewport handling');
const {initLift,persistLift,savePlan}=await import('../js/lift-store.js');
lift.edit={_dirty:false,version:1,days:[]};const editor=lift.edit;
store.api=async()=>({plan:{version:3,units:'kg'},days:[]});await savePlan({});assert.equal(lift.edit,editor,'sheet saves preserve a clean Plan handler object');assert.equal(editor.version,3);
lift.draft={id:'private-a',timer_end:null};persistLift('draft',lift.draft);const firstNamespace=lift.namespace;
store.k='sample-b';await initLift();assert.notEqual(lift.namespace,firstNamespace);assert.equal(lift.draft,null);assert.equal(lift.edit,null);
store.k='sample-a';await initLift();assert.equal(lift.draft.id,'private-a');console.log('ok  Private-key draft isolation and clean editor identity across sheet saves');
