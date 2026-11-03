// The challenge rules, in one place. Mirrors supabase/functions/_shared/rules.ts.
export const TOTAL = 75;
export const WATER_GOAL = 8;
export const OZ_PER_BOTTLE = 16;

export const TASKS = [
  { key: "w1", title: "Workout 1", meta: ["45 min"], icon: "workout" },
  { key: "w2", title: "Workout 2", meta: ["45 min", "Outdoors"], icon: "outdoor" },
  { key: "diet", title: "Diet", meta: ["No cheat meals", "No alcohol"], icon: "diet" },
  { key: "water", title: "Water", meta: ["1 gallon"], icon: "water" },
  { key: "read", title: "Read", meta: ["10 pages", "Non-fiction"], icon: "read" },
  { key: "photo", title: "Progress photo", meta: ["Daily"], icon: "photo" },
];

export const blank = (day) => ({ day, w1: false, w2: false, diet: false, water: 0, read: false, photo: false });

export const taskDone = (e, key) => (key === "water" ? (e?.water ?? 0) >= WATER_GOAL : !!e?.[key]);
export const doneCount = (e) => TASKS.reduce((n, t) => n + (taskDone(e, t.key) ? 1 : 0), 0);

export function isComplete(e) {
  return !!(e && e.diet && (e.water ?? 0) >= WATER_GOAL && e.read && e.photo && (e.w1 || e.w2));
}
export const isOneWorkout = (e) => isComplete(e) && !(e.w1 && e.w2);

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const diffDays = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
export const dayNum = (start, day) => diffDays(start, day) + 1;

/**
 * Everything the UI needs for one person. The single finish-line calculation:
 * Today, Board and Settings all read it from here.
 * No restarts: each unfinished past day adds `penalty` days (1 or 2) to the end.
 * Completed days needed = 75 + missed × (penalty − 1).
 * Mirrors progress() in supabase/functions/_shared/rules.ts; keep them identical.
 */
export function personStats(p, start, penalty = 1) {
  const today = p.today;
  const map = new Map(p.entries.map((e) => [e.day, e]));
  const days = []; // calendar days from start through today (or until finished)
  let completed = 0, oneWorkout = 0, missed = 0, finishedOn = null;
  const milestones = {}; // 25 / 50 -> the day that completion landed on

  if (today >= start) {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      const e = map.get(d);
      const c = isComplete(e);
      let status;
      if (c) {
        completed++;
        if (isOneWorkout(e)) oneWorkout++;
        status = isOneWorkout(e) ? "one" : "done";
        if (completed === 25 || completed === 50) milestones[completed] = d;
        if (completed >= TOTAL + missed * (penalty - 1)) finishedOn = d;
      } else if (d < today) {
        missed++;
        status = "missed";
      } else status = "today";
      days.push({ day: d, status, entry: e });
      if (finishedOn) break;
    }
  }

  // Current streak: consecutive complete days ending today (or yesterday if today is open).
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].status;
    if (s === "done" || s === "one") streak++;
    else if (s === "today" && i === days.length - 1) continue;
    else break;
  }

  const added = missed * penalty;
  const target = TOTAL + missed * (penalty - 1);
  const finish = finishedOn ?? addDays(start, TOTAL - 1 + added);
  const last = days[days.length - 1];
  const prev = last?.status === "today" ? days[days.length - 2] : last;
  return {
    today, started: today >= start, completed, oneWorkout, missed, added, target, streak, finish,
    finished: !!finishedOn, finishedOn, days, map, milestones, penalty,
    lastClosedMissed: prev?.status === "missed", // most recent finished day was a miss
    dayNumber: today >= start ? dayNum(start, today) : 0,
    left: Math.max(0, target - completed),
  };
}

/** Water pacing: where you'd want to be by now (7am → 9pm). */
export function waterPace(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const t = (m - 7 * 60) / (14 * 60);
  return Math.max(0, Math.min(WATER_GOAL, Math.floor(t * WATER_GOAL)));
}

export const REMINDERS = [
  { key: "w1", label: "Workout 1", at: "06:45" },
  { key: "w2", label: "Outdoor workout", at: "15:30" },
  { key: "evening", label: "Evening check-in", at: "20:30" },
];

/** "06:45" -> "6:45am" */
export function fmtTime(s) {
  const h = Number(s.slice(0, 2)), m = s.slice(3, 5);
  return `${h % 12 || 12}:${m}${h < 12 ? "am" : "pm"}`;
}

/** Diet subtitle: the person's own rule, always with "No alcohol". */
export function dietMeta(rule) {
  const r = (rule ?? "").trim();
  if (!r) return ["No cheat meals", "No alcohol"];
  return /\bno alcohol\b/i.test(r) ? [r] : [r, "No alcohol"];
}
