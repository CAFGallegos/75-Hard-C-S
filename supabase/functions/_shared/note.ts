// Daily-note timing: which local minutes a person's note may go out at today.
// Pure (no database) so tests/note-slots.test.ts can check every rule.

export const NOTE = {
  chance: 0.75, // most days, not every day
  from: 6 * 60, // 6:00am local
  to: 23 * 60, // 11:00pm local
  step: 5, // the sender runs every 5 minutes
  awayFromReminders: 45, // minutes from that person's other (enabled) reminders
  awayFromYesterday: 60, // never the same time two days in a row
  awayFromPartner: 30, // never the same moment as the other person
};

const fmts = new Map<string, Intl.DateTimeFormat>();
const fmtFor = (tz: string) => {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmts.set(tz, f);
  }
  return f;
};

/** Minutes the zone is ahead of UTC at a given instant. */
export function tzOffset(tz: string, at: Date): number {
  const p = Object.fromEntries(fmtFor(tz).formatToParts(at).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - at.getTime()) / 60000);
}

/** The absolute instant for a local day + minutes in a zone (DST-safe). */
export function localToUtc(tz: string, day: string, minutes: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - tzOffset(tz, new Date(guess)) * 60000;
  return new Date(guess - tzOffset(tz, new Date(first)) * 60000);
}

/** Every allowed local minute for today's note, honoring all the spacing rules. */
export function noteSlots(o: {
  tz: string;
  day: string;
  now: number; // local minutes right now (only later slots are allowed)
  reminderMins: number[]; // this person's enabled reminder times
  yesterdayMin: number | null; // yesterday's note time, if one was planned
  partnerTimes: number[]; // the other person's planned note instants (ms)
}): number[] {
  const slots: number[] = [];
  for (let m = NOTE.from; m <= NOTE.to; m += NOTE.step) {
    if (m < o.now + NOTE.step) continue;
    if (o.reminderMins.some((r) => Math.abs(m - r) < NOTE.awayFromReminders)) continue;
    if (o.yesterdayMin != null && Math.abs(m - o.yesterdayMin) < NOTE.awayFromYesterday) continue;
    const t = localToUtc(o.tz, o.day, m).getTime();
    if (o.partnerTimes.some((x) => Math.abs(t - x) < NOTE.awayFromPartner * 60000)) continue;
    slots.push(m);
  }
  return slots;
}
