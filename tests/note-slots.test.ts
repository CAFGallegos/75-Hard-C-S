// Daily-note timing: run with `deno run tests/note-slots.test.ts`
// Simulates 80 days of planning for both people (Los in Chicago, Sue in Los Angeles),
// many times over, and checks every rule on the times that come out.
import { localToUtc, NOTE, noteSlots } from "../supabase/functions/_shared/note.ts";
import { addDays } from "../supabase/functions/_shared/rules.ts";

const people = [
  { id: "los", tz: "America/Chicago", rem: [6 * 60 + 45, 15 * 60 + 30, 20 * 60 + 30] },
  { id: "sue", tz: "America/Los_Angeles", rem: [7 * 60 + 15, 21 * 60] }, // one reminder off, others moved
];
const fail = (m: string) => { throw new Error(m); };
let sent = 0, planned = 0;

for (let run = 0; run < 40; run++) {
  const plans: Record<string, { day: string; at: number | null; utc: number | null }[]> = { los: [], sue: [] };
  for (let i = 0; i < 80; i++) {
    const day = addDays("2026-11-03", i);
    for (const p of people) { // Los plans first each day (earlier zone), Sue sees his plan
      const other = people.find((x) => x.id !== p.id)!;
      const partnerTimes = plans[other.id].filter((x) => x.utc != null && Math.abs(i - plans[other.id].indexOf(x)) <= 1)
        .map((x) => x.utc!) ;
      const yest = plans[p.id][i - 1]?.at ?? null;
      const slots = noteSlots({ tz: p.tz, day, now: 0, reminderMins: p.rem, yesterdayMin: yest, partnerTimes });
      planned++;
      const send = slots.length > 0 && Math.random() < NOTE.chance;
      const at = send ? slots[Math.floor(Math.random() * slots.length)] : null;
      if (send) sent++;
      plans[p.id].push({ day, at, utc: at == null ? null : localToUtc(p.tz, day, at).getTime() });

      if (at == null) continue;
      if (at < NOTE.from || at > NOTE.to) fail(`${p.id} ${day}: ${at} outside 6am-11pm`);
      for (const r of p.rem) if (Math.abs(at - r) < 45) fail(`${p.id} ${day}: ${at} within 45 min of reminder ${r}`);
      if (yest != null && Math.abs(at - yest) < 60) fail(`${p.id} ${day}: ${at} too close to yesterday ${yest}`);
    }
  }
  // Never the same moment as each other (any day).
  for (const a of plans.los) for (const b of plans.sue) {
    if (a.utc != null && b.utc != null && Math.abs(a.utc - b.utc) < NOTE.awayFromPartner * 60000) {
      fail(`same moment: los ${a.day} ${a.at} / sue ${b.day} ${b.at}`);
    }
  }
}
const rate = sent / planned;
if (rate < 0.65 || rate > 0.85) fail(`send rate ${rate.toFixed(2)} not "most days"`);
console.log(`ok  ${planned} planned days: 6am-11pm, 45+ min from reminders, 60+ min from yesterday, never the same moment; sent on ${(rate * 100).toFixed(0)}% of days`);
