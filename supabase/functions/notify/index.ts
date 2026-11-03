// Daily reminders. Called every 5 minutes by pg_cron (via pg_net) with a shared
// secret. Each person's reminders fire at their own saved local times, in their
// own time zone, and can be switched off one by one.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  addDays,
  diffDays,
  type Entry,
  hhmmToMinutes,
  isComplete,
  minutesIn,
  progress,
  readReminders,
  type ReminderKind,
  todayIn,
  WATER_GOAL,
} from "../_shared/rules.ts";
import { claimLog, pushToPerson } from "../_shared/notify.ts";
import { voice } from "../_shared/voice.ts";
// Same daily line as the app and the widget (copied by tools/sync-shared.sh).
import { dailyLine } from "../_shared/app/daily.js";
import { localToUtc, NOTE, noteSlots } from "../_shared/note.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const WINDOW = 25; // minutes after the target time we still send (covers late cron runs)

function openItems(e: Entry | undefined): string[] {
  const left: string[] = [];
  if (!e?.w1 && !e?.w2) left.push("a workout");
  const water = WATER_GOAL - (e?.water ?? 0);
  if (water > 0) left.push(water === 1 ? "1 bottle" : `${water} bottles`);
  if (!e?.read) left.push("10 pages");
  if (!e?.photo) left.push("your progress pic");
  if (!e?.diet) left.push("the diet check");
  return left;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

// ---------------------------------------------------------------- Daily note
const randInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const rand01 = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

type Plan = { send: boolean; at_min: number | null; at_utc: string | null };

/** Decide (once) whether and when today's note goes out for this person. */
async function notePlan(
  p: { id: string; tz: string },
  today: string,
  now: number,
  reminderMins: number[],
): Promise<Plan> {
  const existing = await db.from("daily_note_plan").select("send,at_min,at_utc")
    .eq("person_id", p.id).eq("day", today).maybeSingle();
  if (existing.data) return existing.data as Plan;

  const [{ data: yest }, { data: others }] = await Promise.all([
    db.from("daily_note_plan").select("at_min").eq("person_id", p.id).eq("day", addDays(today, -1)).maybeSingle(),
    db.from("daily_note_plan").select("at_utc").neq("person_id", p.id)
      .gte("day", addDays(today, -1)).lte("day", addDays(today, 1)).not("at_utc", "is", null),
  ]);
  const slots = noteSlots({
    tz: p.tz,
    day: today,
    now,
    reminderMins,
    yesterdayMin: yest?.at_min ?? null,
    partnerTimes: (others ?? []).map((o) => Date.parse(o.at_utc as string)),
  });
  const send = slots.length > 0 && rand01() < NOTE.chance;
  const at = send ? slots[randInt(slots.length)] : null;
  await db.from("daily_note_plan").upsert({
    person_id: p.id,
    day: today,
    send,
    at_min: at,
    at_utc: at == null ? null : localToUtc(p.tz, today, at).toISOString(),
  }, { onConflict: "person_id,day", ignoreDuplicates: true });
  // Read back: if another run planned first, use its plan.
  const { data } = await db.from("daily_note_plan").select("send,at_min,at_utc")
    .eq("person_id", p.id).eq("day", today).single();
  return data as Plan;
}

type Msg = { title: string; body: string };
const REMINDERS: { kind: ReminderKind; skip: (e?: Entry) => boolean; msg: (id: string, n: number, e?: Entry) => Msg }[] = [
  {
    kind: "w1",
    skip: (e) => !!e?.w1,
    msg: (id, n) => ({ title: `Day ${n}. Workout 1.`, body: voice(id).morning }),
  },
  {
    kind: "w2",
    skip: (e) => !!e?.w2,
    msg: (_id, n) => ({ title: "Outdoor workout", body: `45 minutes outside for Day ${n}. Whatever the weather.` }),
  },
  {
    kind: "evening",
    skip: (e) => isComplete(e),
    msg: (id, n, e) => {
      const left = openItems(e);
      return {
        title: `Check in for Day ${n}`,
        body: `${voice(id).evening}\nStill open: ${joinList(left.length ? left : ["your check-in"])}.`,
      };
    },
  },
];

Deno.serve(async (req) => {
  const { data: secret } = await db.from("app_secrets").select("value").eq("name", "cron_secret").single();
  if (!secret || req.headers.get("x-cron-secret") !== secret.value) {
    return new Response("forbidden", { status: 403 });
  }

  const [{ data: people }, { data: settings }, { data: entries }] = await Promise.all([
    db.from("people").select("id,name,tz,reminders"),
    db.from("app_settings").select("start_date,miss_penalty").eq("id", 1).single(),
    db.from("entries").select("person_id,day,w1,w2,diet,water,read,photo"),
  ]);
  const start = settings!.start_date as string;
  const penalty = (settings!.miss_penalty as number) ?? 1;
  const log: unknown[] = [];

  for (const p of people ?? []) {
    const today = todayIn(p.tz);
    if (today < start) continue;
    const mine = (entries ?? []).filter((e) => e.person_id === p.id) as unknown as Entry[];
    // Finished before today? Then no more nudges.
    if (progress(mine.filter((e) => e.day < today), start, today, penalty).finished) continue;

    const saved = readReminders(p.reminders);
    const now = minutesIn(p.tz);
    const e = mine.find((x) => x.day === today);
    const dayNum = diffDays(start, today) + 1;

    for (const r of REMINDERS) {
      const cfg = saved[r.kind];
      if (!cfg.on) continue;
      const at = hhmmToMinutes(cfg.at);
      if (now < at || now >= at + WINDOW) continue;
      if (r.skip(e)) continue;
      if (!(await claimLog(db, p.id, r.kind, today))) continue;
      const res = await pushToPerson(db, p.id, { ...r.msg(p.id, dayNum, e), tag: `${r.kind}-${today}` });
      log.push({ person: p.id, kind: r.kind, ...res });
    }

    // Daily note: today's line, once, at this person's planned random time.
    if (saved.note.on) {
      const line = dailyLine(p.id, { entries: mine }, start, penalty, today);
      if (line) {
        const reminderMins = REMINDERS.filter((r) => saved[r.kind].on).map((r) => hhmmToMinutes(saved[r.kind].at));
        const plan = await notePlan(p, today, now, reminderMins);
        if (plan.send && plan.at_min != null && now >= plan.at_min && now < plan.at_min + WINDOW &&
          await claimLog(db, p.id, "note", today)) {
          const res = await pushToPerson(db, p.id, { title: "S v C", body: line, tag: `note-${today}` });
          log.push({ person: p.id, kind: "note", ...res });
        }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, log }), { headers: { "Content-Type": "application/json" } });
});
