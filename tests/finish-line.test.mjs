// Finish-line math: run with `node tests/finish-line.test.mjs`
// (optionally `deno run tests/finish-line.test.mjs` also checks the server copy).
import assert from "node:assert/strict";
import { personStats, addDays } from "../js/rules.js";

const START = "2026-11-03";
const full = (day) => ({ day, w1: true, w2: true, diet: true, water: 8, read: true, photo: true });
// 10 finished days (Nov 3-12), today is Nov 13 (open). `missed` = indexes left incomplete.
function person(missed = []) {
  const entries = [];
  for (let i = 0; i < 10; i++) {
    const e = full(addDays(START, i));
    if (missed.includes(i)) e.read = false;
    entries.push(e);
  }
  return { today: addDays(START, 10), entries };
}

const cases = [
  { name: "0 missed", missed: [], penalty: 1, added: 0, target: 75, finish: "2027-01-16" },
  { name: "2 missed at 1x", missed: [2, 6], penalty: 1, added: 2, target: 75, finish: "2027-01-18" },
  { name: "2 missed at 2x", missed: [2, 6], penalty: 2, added: 4, target: 77, finish: "2027-01-20" },
];

let server = null;
if (typeof Deno !== "undefined") server = await import("../supabase/functions/_shared/rules.ts");

for (const c of cases) {
  const s = personStats(person(c.missed), START, c.penalty);
  assert.equal(s.added, c.added, `${c.name}: added`);
  assert.equal(s.target, c.target, `${c.name}: completed days needed`);
  assert.equal(s.finish, c.finish, `${c.name}: finish date`);
  assert.equal(s.completed, 10 - c.missed.length, `${c.name}: completed`);
  // Finish = start + 74 + added; and finishing every remaining day lands exactly on it.
  assert.equal(s.finish, addDays(START, 74 + c.added));
  if (server) {
    const p = person(c.missed);
    const r = server.progress(p.entries, START, p.today, c.penalty);
    assert.deepEqual([r.added, r.target, r.finish], [s.added, s.target, s.finish], `${c.name}: server matches app`);
  }
  console.log(`ok  ${c.name.padEnd(16)} added +${s.added}  needs ${s.target}  finish ${s.finish}`);
}

// Simulate finishing every remaining day: the finish flag lands on the projected date.
for (const c of cases) {
  const p = person(c.missed);
  const proj = personStats(p, START, c.penalty).finish;
  for (let d = p.today; d <= proj; d = addDays(d, 1)) p.entries.push(full(d));
  p.today = proj;
  const s = personStats(p, START, c.penalty);
  assert.equal(s.finished, true, `${c.name}: finished`);
  assert.equal(s.finishedOn, proj, `${c.name}: finishes on the projected day`);
}
console.log("ok  projected finish is reached exactly when every remaining day is completed");
