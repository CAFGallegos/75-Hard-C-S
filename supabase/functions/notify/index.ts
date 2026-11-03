// Daily reminders. Called every 5 minutes by pg_cron (via pg_net) with a shared
// secret. Each person gets nudges at fixed local times in their own time zone.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { completedCount, diffDays, type Entry, isComplete, minutesIn, TOTAL_DAYS, todayIn, WATER_GOAL } from
  "../_shared/rules.ts";
import { claimLog, pushToPerson } from "../_shared/notify.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const WINDOW = 25; // minutes after the target time we still send (covers late cron runs)

type Reminder = {
  kind: string;
  at: number; // local minutes after midnight
  skip: (e: Entry | undefined) => boolean;
  msg: (dayNum: number, e: Entry | undefined) => { title: string; body: string };
};

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

const REMINDERS: Reminder[] = [
  {
    kind: "w1",
    at: 6 * 60 + 45,
    skip: (e) => !!e?.w1,
    msg: (n) => ({ title: `Day ${n}. Workout 1.`, body: "45 minutes. Get it in before the day gets loud." }),
  },
  {
    kind: "w2",
    at: 15 * 60 + 30,
    skip: (e) => !!e?.w2,
    msg: (n) => ({ title: "Outdoor workout", body: `45 minutes outside for Day ${n}. Whatever the weather.` }),
  },
  {
    kind: "evening",
    at: 20 * 60 + 30,
    skip: (e) => isComplete(e),
    msg: (n, e) => {
      const left = openItems(e);
      return {
        title: `Check in for Day ${n}`,
        body: left.length ? `Still open: ${joinList(left)}.` : "Read, snap your pic, and check in.",
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
    db.from("people").select("id,name,tz"),
    db.from("app_settings").select("start_date").eq("id", 1).single(),
    db.from("entries").select("person_id,day,w1,w2,diet,water,read,photo"),
  ]);
  const start = settings!.start_date as string;
  const log: unknown[] = [];

  for (const p of people ?? []) {
    const today = todayIn(p.tz);
    if (today < start) continue;
    const mine = (entries ?? []).filter((e) => e.person_id === p.id) as unknown as Entry[];
    const yesterdayDone = completedCount(mine, start, today) - (isComplete(mine.find((e) => e.day === today)) ? 1 : 0);
    if (yesterdayDone >= TOTAL_DAYS) continue; // finished the challenge
    const now = minutesIn(p.tz);
    const e = mine.find((x) => x.day === today);
    const dayNum = diffDays(start, today) + 1;

    for (const r of REMINDERS) {
      if (now < r.at || now >= r.at + WINDOW) continue;
      if (r.skip(e)) continue;
      if (!(await claimLog(db, p.id, r.kind, today))) continue;
      const m = r.msg(dayNum, e);
      const res = await pushToPerson(db, p.id, { ...m, tag: `${r.kind}-${today}` });
      log.push({ person: p.id, kind: r.kind, ...res });
    }
  }
  return new Response(JSON.stringify({ ok: true, log }), { headers: { "Content-Type": "application/json" } });
});
