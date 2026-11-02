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
