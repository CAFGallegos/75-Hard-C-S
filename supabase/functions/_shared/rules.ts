// Shared 75 Hard rules. Mirrors js/rules.js in the web app.

export interface Entry {
  day: string;
  w1: boolean;
  w2: boolean;
  diet: boolean;
  water: number;
  read: boolean;
  photo: boolean;
}

export const WATER_GOAL = 8;
export const TOTAL_DAYS = 75;

/** A day counts when everything is done; one workout is allowed (noted). */
export function isComplete(e: Partial<Entry> | null | undefined): boolean {
  if (!e) return false;
  return !!(e.diet && (e.water ?? 0) >= WATER_GOAL && e.read && e.photo && (e.w1 || e.w2));
}

export function isOneWorkout(e: Partial<Entry> | null | undefined): boolean {
  return isComplete(e) && !(e!.w1 && e!.w2);
}

/** YYYY-MM-DD for "now" in an IANA time zone. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now);
}

/** Minutes since local midnight in an IANA time zone. */
export function minutesIn(tz: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00Z"));
}

/** Completed-day count from the start date through `through` (inclusive). */
export function completedCount(entries: Entry[], start: string, through: string): number {
  return entries.filter((e) => e.day >= start && e.day <= through && isComplete(e)).length;
}

/**
 * The finish-line math. Mirrors personStats() in js/rules.js; keep them identical.
 * No restarts: each unfinished past day adds `penalty` days (1 or 2) to the end.
 * Completed days needed = 75 + missed × (penalty − 1).
 */
export function progress(entries: Entry[], start: string, today: string, penalty = 1) {
  const map = new Map(entries.map((e) => [e.day, e]));
  let completed = 0, missed = 0;
  let finishedOn: string | null = null;
  if (today >= start) {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (isComplete(map.get(d))) {
        completed++;
        if (completed >= TOTAL_DAYS + missed * (penalty - 1)) finishedOn = d;
      } else if (d < today) missed++;
      if (finishedOn) break;
    }
  }
  const added = missed * penalty;
  return {
    completed,
    missed,
    added,
    target: TOTAL_DAYS + missed * (penalty - 1),
    finished: !!finishedOn,
    finish: finishedOn ?? addDays(start, TOTAL_DAYS - 1 + added),
  };
}

export type ReminderKind = "w1" | "w2" | "evening";
export type Reminders = Record<ReminderKind, { at: string; on: boolean }>;
export const REMINDER_DEFAULTS: Reminders = {
  w1: { at: "06:45", on: true },
  w2: { at: "15:30", on: true },
  evening: { at: "20:30", on: true },
};

export const isHHMM = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Saved reminders with defaults filled in for anything missing or malformed. */
export function readReminders(raw: unknown): Reminders {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, { at?: unknown; on?: unknown }>;
  const out = {} as Reminders;
  for (const k of Object.keys(REMINDER_DEFAULTS) as ReminderKind[]) {
    const v = r[k] ?? {};
    out[k] = {
      at: isHHMM(v.at) ? v.at : REMINDER_DEFAULTS[k].at,
      on: typeof v.on === "boolean" ? v.on : REMINDER_DEFAULTS[k].on,
    };
  }
  return out;
}

export const hhmmToMinutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** "06:45" -> "6:45am" */
export function fmtTime(s: string) {
  const h = Number(s.slice(0, 2)), m = s.slice(3, 5);
  return `${h % 12 || 12}:${m}${h < 12 ? "am" : "pm"}`;
}
