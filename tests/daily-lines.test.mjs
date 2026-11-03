// Daily lines: run with `node tests/daily-lines.test.mjs`
// Replays every day of the challenge for both people under a few scenarios and checks:
// no line repeats within 10 days, each final-stretch line shows exactly once (5 → 3 → 1),
// no line on the finish day, specials land on their days, weekend lines only on their weekday.
import assert from "node:assert/strict";
import { dailyLines } from "../js/daily.js";
import { SUE, LOS, SPECIAL_DAYS, SPECIAL_DATES, FINAL_STRETCH, NO_REPEAT_DAYS } from "../js/daily-lines.js";
import { addDays, dayNum, personStats } from "../js/rules.js";

const START = "2026-11-03";
const full = (day) => ({ day, w1: true, w2: true, diet: true, water: 8, read: true, photo: true });
const LINES = { sue: SUE, los: LOS };
const WD = { 5: "fri", 6: "sat", 0: "sun" };

/** Complete every day until the finish, except the given miss day numbers. */
function simulate(missDays, penalty) {
  const entries = [];
  let day = START;
  for (let n = 1; n < 400; n++, day = addDays(day, 1)) {
    if (!missDays.includes(n)) entries.push(full(day));
    const s = personStats({ today: day, entries }, START, penalty);
    if (s.finished) return { entries, finish: day };
  }
  throw new Error("never finished");
}

const scenarios = [
  { name: "no misses", miss: [], penalty: 1 },
  { name: "3 misses, 1 day each", miss: [9, 40, 66], penalty: 1 },
  { name: "3 misses, 2 days each", miss: [9, 40, 66], penalty: 2 },
  { name: "miss in the final stretch, 1x", miss: [72], penalty: 1 },
  { name: "miss in the final stretch, 2x", miss: [73], penalty: 2 },
];

for (const sc of scenarios) {
  const { entries, finish } = simulate(sc.miss, sc.penalty);
  for (const id of ["sue", "los"]) {
    const person = { entries };
    const through = addDays(finish, 2);
    const days = dailyLines(id, person, START, sc.penalty, through);
    const label = `${sc.name} / ${id}`;

    // Same answer every time (same on every device).
    assert.deepEqual(dailyLines(id, person, START, sc.penalty, through), days, `${label}: deterministic`);

    // Every day before the finish has a line; the finish day and after have none.
    for (const d of days) {
      if (d.day < finish) assert.ok(d.text, `${label}: line on ${d.day}`);
      else assert.equal(d.text, null, `${label}: no line on/after finish (${d.day})`);
    }

    // No repeats within NO_REPEAT_DAYS.
    const seen = new Map();
    days.forEach((d, i) => {
      if (!d.text) return;
      if (seen.has(d.text)) {
        const gap = i - seen.get(d.text);
        assert.ok(gap > NO_REPEAT_DAYS, `${label}: "${d.text}" repeated after ${gap} days (${d.day})`);
      }
      seen.set(d.text, i);
    });

    // Final stretch: each line exactly once, in order, on the day with that many days left.
    const stretch = days.filter((d) => d.kind === "stretch");
    const expected = [5, 3, 1].filter((n) => FINAL_STRETCH[n]?.[id]);
    assert.deepEqual(stretch.map((d) => d.text), expected.map((n) => FINAL_STRETCH[n][id]), `${label}: stretch lines once, in order`);
    for (const n of expected) {
      const txt = FINAL_STRETCH[n][id];
      assert.equal(days.filter((d) => d.text === txt).length, 1, `${label}: "${txt}" shows once`);
    }
    // "1 left" lands the day before the finish when that day was completed.
    const oneLeft = stretch.find((d) => d.text === FINAL_STRETCH[1][id]);
    assert.ok(oneLeft && oneLeft.day < finish, `${label}: 1-left before finish`);

    // Specials land on their days (unless a final-stretch line took that day).
    for (const d of days) {
      if (!d.text || d.kind === "stretch") continue;
      const sd = SPECIAL_DAYS[dayNum(START, d.day)]?.[id];
      const sdate = SPECIAL_DATES[d.day.slice(5)]?.[id];
      if (sd) assert.equal(d.text, sd, `${label}: day ${dayNum(START, d.day)} special`);
      else if (sdate) assert.equal(d.text, sdate, `${label}: ${d.day} special`);
      if (d.kind === "weekend") {
        const wk = WD[new Date(d.day + "T12:00:00Z").getUTCDay()];
        assert.ok(wk && LINES[id].weekend[wk].includes(d.text), `${label}: weekend line on a ${wk ?? "weekday"}`);
      }
      if (d.kind === "pool") assert.ok(LINES[id].pool.includes(d.text), `${label}: pool line`);
    }

    const kinds = days.reduce((m, d) => ((m[d.kind] = (m[d.kind] ?? 0) + 1), m), {});
    console.log(`ok  ${label.padEnd(40)} finish ${finish}  ${JSON.stringify(kinds)}`);
  }
}
console.log("ok  all scenarios: no repeats within 10 days, final stretch once each, nothing on finish day");
