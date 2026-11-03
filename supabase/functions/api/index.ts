// 75 Hard API. Every request carries a private key (k). The key is hashed and
// matched to a person; all reads/writes use the service role. The browser never
// talks to tables or storage directly.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { diffDays, isISODate, isOneWorkout, todayIn, type Entry } from "../_shared/rules.ts";
import { claimLog, getVapid, pushToPerson } from "../_shared/notify.ts";

const BUCKET = "progress-photos";
const SIGNED_URL_TTL = 300; // seconds
const MAX_PHOTO_BYTES = 4_500_000;
const BOOL_FIELDS = ["w1", "w2", "diet", "read", "photo"] as const;
const PHOTO_MODES = ["phone", "album", "cloud", "checkbox"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-key",
  "Access-Control-Max-Age": "86400",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const db: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface Person {
  id: string;
  name: string;
  tz: string;
  photo_mode: string;
  onboarded: boolean;
  tips: Record<string, unknown>;
  pending_photo_day: string | null;
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function personForKey(k: unknown): Promise<Person> {
  if (typeof k !== "string" || k.length < 32 || k.length > 128) throw new HttpError(401, "bad_key");
  const { data } = await db.from("people")
    .select("id,name,tz,photo_mode,onboarded,tips,pending_photo_day")
    .eq("key_hash", await sha256Hex(k))
    .maybeSingle();
  if (!data) throw new HttpError(401, "bad_key");
  return data as Person;
}

async function startDate(): Promise<string> {
  const { data } = await db.from("app_settings").select("start_date").eq("id", 1).single();
  return data!.start_date;
}

async function state(me: Person) {
  const [{ data: people }, { data: entries }, start, vapid, { count: devices }, { count: photoCount }] =
    await Promise.all([
      db.from("people").select("id,name,tz").order("id"),
      db.from("entries").select("person_id,day,w1,w2,diet,water,read,photo").order("day"),
      startDate(),
      getVapid(db),
      db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("person_id", me.id),
      db.from("photos").select("id", { count: "exact", head: true }).eq("person_id", me.id),
    ]);
  return {
    me: {
      id: me.id,
      name: me.name,
      tz: me.tz,
      photo_mode: me.photo_mode,
      onboarded: me.onboarded,
      tips: me.tips ?? {},
      push_devices: devices ?? 0,
      photo_count: photoCount ?? 0,
    },
    start_date: start,
    vapid_public: vapid.publicKey,
    server_time: new Date().toISOString(),
    people: (people ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      tz: p.tz,
      today: todayIn(p.tz),
      // Partner sees only booleans; photos never leave the owner.
      entries: (entries ?? []).filter((e) => e.person_id === p.id).map(({ person_id: _p, ...e }) => e),
    })),
  };
}

async function assertEditableDay(me: Person, day: unknown): Promise<string> {
  if (!isISODate(day)) throw new HttpError(400, "bad_day");
  const start = await startDate();
  const today = todayIn(me.tz);
  if (day < start) throw new HttpError(400, "before_start");
  if (day > today) throw new HttpError(400, "future_day");
  return day;
}

/**
 * Write only the sent fields to a day (atomically, in the save_entry RPC, so overlapping saves
 * can't overwrite each other) and fire the partner notification if the day just closed.
 */
async function writeEntry(me: Person, day: string, patch: Partial<Entry>) {
  const { data, error } = await db.rpc("save_entry", { p_person_id: me.id, p_day: day, p_patch: patch });
  if (error || !data) throw new HttpError(500, "write_failed");
  const res = data as { was_complete: boolean; is_complete: boolean; entry: Entry };

  if (!res.was_complete && res.is_complete && day === todayIn(me.tz)) {
    const job = notifyPartner(me, res.entry);
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(job);
    else await job;
  }
}

async function notifyPartner(me: Person, e: Entry) {
  try {
    const start = await startDate();
    const dayNum = diffDays(start, e.day) + 1;
    const { data: others } = await db.from("people").select("id").neq("id", me.id);
    for (const o of others ?? []) {
      if (!(await claimLog(db, o.id, `partner_done:${me.id}`, e.day))) continue;
      await pushToPerson(db, o.id, {
        title: `${me.name} closed out Day ${dayNum}`,
        body: isOneWorkout(e)
          ? `Day ${dayNum} is done, with 1 workout. Your move.`
          : `All six done for Day ${dayNum}. Your move.`,
        tag: `partner-${me.id}-${e.day}`,
        person: me.id,
      });
    }
  } catch (_e) { /* best effort */ }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function uploadPhoto(me: Person, dayIn: unknown, data: unknown) {
  const day = await assertEditableDay(me, dayIn);
  if (typeof data !== "string" || !data.length) throw new HttpError(400, "no_file");
  const b64 = data.replace(/^data:image\/jpeg;base64,/, "");
  if (b64.length > MAX_PHOTO_BYTES * 1.37) throw new HttpError(413, "too_big");
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(b64);
  } catch {
    throw new HttpError(400, "bad_file");
  }
  if (bytes.length > MAX_PHOTO_BYTES) throw new HttpError(413, "too_big");
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new HttpError(415, "not_jpeg");

  // One photo per day. Upload the new file, swap the database record, and only then delete the
  // old file. If anything fails before the swap commits, the old photo and record stay intact.
  const path = `${me.id}/${day}/${crypto.randomUUID()}.jpg`;
  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new HttpError(500, "upload_failed");
  const { data: oldPath, error } = await db.rpc("replace_photo", {
    p_person_id: me.id,
    p_day: day,
    p_path: path,
    p_bytes: bytes.length,
  });
  if (error) {
    await db.storage.from(BUCKET).remove([path]); // only the new, unreferenced file
    throw new HttpError(500, "upload_failed");
  }
  if (typeof oldPath === "string" && oldPath !== path) {
    const rm = await db.storage.from(BUCKET).remove([oldPath]);
    if (rm.error) console.error("old photo cleanup failed", oldPath, rm.error.message);
  }
  await writeEntry(me, day, { photo: true });
  return state(me);
}

async function listPhotos(me: Person) {
  const { data: rows } = await db.from("photos").select("id,day,path,created_at").eq("person_id", me.id)
    .order("day");
  if (!rows?.length) return [];
  const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    SIGNED_URL_TTL,
  );
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ id: r.id, day: r.day, url: byPath.get(r.path) ?? null, created_at: r.created_at }));
}

async function deletePhotos(me: Person, ids: string[] | null) {
  let q = db.from("photos").select("id,path").eq("person_id", me.id); // ownership enforced here
  if (ids) q = q.in("id", ids);
  const { data: rows } = await q;
  if (!rows?.length) return 0;
  const paths = rows.map((r) => r.path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new HttpError(500, "delete_failed");
  }
  await db.from("photos").delete().in("id", rows.map((r) => r.id)).eq("person_id", me.id);
  return rows.length;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") throw new HttpError(405, "method");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "bad_json");
  }
  const me = await personForKey(body.k);
  const a = body.a;

  switch (a) {
    case "state":
      return json(await state(me));

    case "set": {
      const day = await assertEditableDay(me, body.day);
      const patch: Partial<Entry> = {};
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      for (const f of BOOL_FIELDS) if (typeof fields[f] === "boolean") patch[f] = fields[f] as boolean;
      if (fields.water !== undefined) {
        const w = Number(fields.water);
        if (!Number.isInteger(w) || w < 0 || w > 8) throw new HttpError(400, "bad_water");
        patch.water = w;
      }
      if (!Object.keys(patch).length) throw new HttpError(400, "no_fields");
      await writeEntry(me, day, patch);
      return json(await state(me));
    }

    case "prefs": {
      const upd: Record<string, unknown> = {};
      if (body.photo_mode !== undefined) {
        if (!PHOTO_MODES.includes(body.photo_mode as string)) throw new HttpError(400, "bad_mode");
        upd.photo_mode = body.photo_mode;
      }
      if (typeof body.onboarded === "boolean") upd.onboarded = body.onboarded;
      if (body.tips && typeof body.tips === "object") {
        const merged = { ...(me.tips ?? {}) } as Record<string, unknown>;
        for (const [k, v] of Object.entries(body.tips as Record<string, unknown>)) {
          if (/^[a-z_]{1,32}$/.test(k) && typeof v === "boolean") merged[k] = v;
        }
        upd.tips = merged;
      }
      if (!Object.keys(upd).length) throw new HttpError(400, "no_fields");
      await db.from("people").update(upd).eq("id", me.id);
      return json(await state({ ...me, ...upd } as Person));
    }

    case "start_date": {
      if (!isISODate(body.start_date)) throw new HttpError(400, "bad_day");
      const today = todayIn(me.tz);
      if (Math.abs(diffDays(today, body.start_date)) > 400) throw new HttpError(400, "out_of_range");
      await db.from("app_settings").update({ start_date: body.start_date, updated_at: new Date().toISOString() })
        .eq("id", 1);
      return json(await state(me));
    }

    case "photo_pending": {
      const day = await assertEditableDay(me, body.day);
      await db.from("people").update({ pending_photo_day: day }).eq("id", me.id);
      return json({ ok: true });
    }

    case "photo_return": {
      // Back from the iOS Shortcut: mark the day they started from (or today).
      const today = todayIn(me.tz);
      const start = await startDate();
      let day = me.pending_photo_day ?? today;
      if (day < start || day > today || diffDays(day, today) > 2) day = today;
      if (day >= start) await writeEntry(me, day, { photo: true });
      await db.from("people").update({ pending_photo_day: null }).eq("id", me.id);
      return json({ ...(await state(me)), marked: day >= start ? day : null });
    }

    case "photo_upload":
      return json(await uploadPhoto(me, body.day, body.data));

    case "photos":
      return json({ photos: await listPhotos(me), ttl: SIGNED_URL_TTL });

    case "photo_delete": {
      if (typeof body.id !== "string") throw new HttpError(400, "bad_id");
      const n = await deletePhotos(me, [body.id]);
      if (!n) throw new HttpError(404, "not_found");
      return json({ deleted: n, photos: await listPhotos(me) });
    }

    case "photos_delete_all":
      return json({ deleted: await deletePhotos(me, null), photos: [] });

    case "push_subscribe": {
      const s = body.sub as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!s?.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth) {
        throw new HttpError(400, "bad_sub");
      }
      await db.from("push_subscriptions").upsert(
        { person_id: me.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
        { onConflict: "endpoint" },
      );
      return json({ ok: true });
    }

    case "push_unsubscribe": {
      if (typeof body.endpoint === "string") {
        await db.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("person_id", me.id);
      }
      return json({ ok: true });
    }

    case "push_test": {
      const r = await pushToPerson(db, me.id, {
        title: "You're all set",
        body: "Reminders land at 6:45am, 3:30pm and 8:30pm.",
        tag: "test",
      });
      return json(r);
    }

    default:
      throw new HttpError(400, "unknown_action");
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});

