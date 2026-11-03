// Picks the daily line for a person on a given day. Lines live in js/daily-lines.js.
// Deterministic: it replays every day from the start date, so the result depends only on
// the date, the person and the shared check-in data. Same line on every device, all day.
import { SUE, LOS, SPECIAL_DAYS, SPECIAL_DATES, FINAL_STRETCH, NO_REPEAT_DAYS } from "./daily-lines.js";
import { addDays, dayNum, diffDays, personStats } from "./rules.js";

const LINES = { sue: SUE, los: LOS };
const WEEKEND = { 5: "fri", 6: "sat", 0: "sun" };

/** FNV-1a: a small stable hash so the pick is the same everywhere. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Days left after `day` until this person's finish line, as it stood that day
 * (missed days before it push the finish back). null once the finish day arrives.
 */
function daysLeftOn(person, start, penalty, day) {
  const s = personStats({ today: day, entries: person.entries }, start, penalty);
  if (s.finishedOn && s.finishedOn <= day) return null;
  const left = diffDays(day, s.finish);
  return left > 0 ? left : null;
}

/**
 * Every day's line from the start date through `through`.
 * Returns [{ day, text, kind }] where kind is stretch | day | date | weekend | pool | none.
 */
export function dailyLines(personId, person, start, penalty, through) {
  const L = LINES[personId];
  const out = [];
  const lastShown = new Map(); // text -> index of the day it last showed
  const stretchShown = new Set();
  if (!L || through < start) return out;

  const fresh = (text, i) => !lastShown.has(text) || i - lastShown.get(text) > NO_REPEAT_DAYS;
  const pickFrom = (list, day, i) => {
    const ok = list.filter((t) => fresh(t, i));
    if (!ok.length) return null;
    return ok[hash(`${personId}|${day}`) % ok.length];
  };

  for (let d = start, i = 0; d <= through; d = addDays(d, 1), i++) {
    let text = null, kind = "none";
    const left = daysLeftOn(person, start, penalty, d);

    if (left === null) {
      // Finish day (or after): no daily line; the milestone covers it.
    } else if (FINAL_STRETCH[left]?.[personId] && !stretchShown.has(left)) {
      stretchShown.add(left);
      text = FINAL_STRETCH[left][personId];
      kind = "stretch";
    } else if (SPECIAL_DAYS[dayNum(start, d)]?.[personId]) {
      text = SPECIAL_DAYS[dayNum(start, d)][personId];
      kind = "day";
    } else if (SPECIAL_DATES[d.slice(5)]?.[personId]) {
      text = SPECIAL_DATES[d.slice(5)][personId];
      kind = "date";
    } else {
      const wk = WEEKEND[new Date(d + "T12:00:00Z").getUTCDay()];
      if (wk) {
        text = pickFrom(L.weekend?.[wk] ?? [], d, i);
        if (text) kind = "weekend";
      }
      if (!text) {
        text = pickFrom(L.pool, d, i);
        if (text) kind = "pool";
        else {
          // Pool smaller than the no-repeat window: fall back to the line shown longest ago.
          text = [...L.pool].sort((a, b) => (lastShown.get(a) ?? -1) - (lastShown.get(b) ?? -1))[0] ?? null;
          kind = text ? "pool" : "none";
        }
      }
    }
    if (text) lastShown.set(text, i);
    out.push({ day: d, text, kind });
  }
  return out;
}

/** The line for one day (usually today), or null. */
export function dailyLine(personId, person, start, penalty, day) {
  const all = dailyLines(personId, person, start, penalty, day);
  return all.length ? all[all.length - 1].text : null;
}
