import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { sendPush, type Vapid } from "./webpush.ts";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  person?: string;
}

let vapidCache: Vapid | null = null;

export async function getVapid(db: SupabaseClient): Promise<Vapid> {
  if (vapidCache) return vapidCache;
  const { data, error } = await db.from("app_secrets").select("name,value").in("name", [
    "vapid_public",
    "vapid_private",
    "vapid_subject",
  ]);
  if (error) throw error;
  const m = Object.fromEntries((data ?? []).map((r) => [r.name, r.value]));
  vapidCache = { publicKey: m.vapid_public, privateKey: m.vapid_private, subject: m.vapid_subject };
  return vapidCache;
}

/** Send to every device a person has registered. Prunes dead subscriptions. */
export async function pushToPerson(db: SupabaseClient, personId: string, payload: PushPayload) {
  const vapid = await getVapid(db);
  const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq(
    "person_id",
    personId,
  );
  let sent = 0;
  for (const s of subs ?? []) {
    const r = await sendPush(s, payload, vapid);
    if (r.ok) sent++;
    else if (r.gone) await db.from("push_subscriptions").delete().eq("id", s.id);
  }
  return { devices: subs?.length ?? 0, sent };
}

/** Insert a dedupe row; returns true only the first time for (person, kind, day). */
export async function claimLog(db: SupabaseClient, personId: string, kind: string, day: string) {
  const { data, error } = await db.from("push_log").upsert(
    { person_id: personId, kind, day },
    { onConflict: "person_id,kind,day", ignoreDuplicates: true },
  ).select();
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
