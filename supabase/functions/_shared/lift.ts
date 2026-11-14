// Validation and private Lift handlers. No challenge state or notification side effects.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export class LiftError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new LiftError('lift_invalid');
  return v as Obj;
};
const num = (v: unknown, min: number, max: number, integer = false): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw new LiftError('lift_invalid');
  return v;
};
const text = (v: unknown, max: number, required = false): string => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new LiftError('lift_invalid');
  return v.trim();
};
export const liftId = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw new LiftError('lift_invalid');
  return v.toLowerCase();
};
const list = (v: unknown, max: number): unknown[] => {
  if (!Array.isArray(v) || v.length > max) throw new LiftError('lift_invalid');
  return v;
};
const unit = (v: unknown): string => { if (v !== 'lb' && v !== 'kg') throw new LiftError('lift_invalid'); return v; };
const stamp = (v: unknown): string => {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw new LiftError('lift_invalid');
  return new Date(v).toISOString();
};
export function validateLiftPlan(input: unknown) {
  const p = object(input), ids = new Set<string>();
  const unique = (v: unknown) => { const id = liftId(v); if (ids.has(id)) throw new LiftError('lift_invalid'); ids.add(id); return id; };
  const plates = list(p.plates, 16).map((v) => num(v, 0.001, 500));
  if (!plates.length || plates.some((v) => Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6)) throw new LiftError('lift_invalid');
  return {
    units: unit(p.units), default_rest_seconds: num(p.default_rest_seconds, 0, 3600, true),
    bar_weight: num(p.bar_weight, 0, 500), plates, version: num(p.version, 0, 2147483646, true),
    days: list(p.days, 14).map((day, position) => {
      const d = object(day);
      return { id: unique(d.id), name: text(d.name, 100, true), position,
        exercises: list(d.exercises, 30).map((exercise, position) => {
          const e = object(exercise);
          const rep_min = num(e.rep_min, 1, 100, true), rep_max = num(e.rep_max, rep_min, 100, true);
          if (!['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'].includes(String(e.equipment))) throw new LiftError('lift_invalid');
          return { id: unique(e.id), name: text(e.name, 120, true), position,
            sets: num(e.sets, 1, 20, true), rep_min, rep_max, target_rir: num(e.target_rir, 0, 10),
            equipment: e.equipment as string, increment: num(e.increment, 0.001, 500),
            rest_seconds: e.rest_seconds === null ? null : num(e.rest_seconds, 0, 3600, true), notes: text(e.notes, 1000) };
        }) };
    }),
  };
}
export function validateLiftSession(input: unknown, tz: string, now = Date.now()) {
  const p = object(input), started_at = stamp(p.started_at), finished_at = stamp(p.finished_at);
  if (Date.parse(started_at) > Date.parse(finished_at) || Date.parse(finished_at) > now + 300000) throw new LiftError('lift_invalid');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(started_at));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const seen = new Set<string>();
  const sets = list(p.sets, 700).map((item) => {
    const s = object(item), exercise_id = liftId(s.exercise_id), set_no = num(s.set_no, 1, 30, true);
    if (typeof s.is_warmup !== 'boolean') throw new LiftError('lift_invalid');
    const key = `${exercise_id}:${set_no}:${s.is_warmup}`;
    if (seen.has(key)) throw new LiftError('lift_invalid'); seen.add(key);
    return { exercise_id, exercise_name: text(s.exercise_name, 120, true), set_no, is_warmup: s.is_warmup,
      weight: num(s.weight, 0, 5000), reps: num(s.reps, 1, 1000, true), rir: num(s.rir, 0, 10), exercise_notes: text(s.exercise_notes, 1000) };
  });
  if (!sets.some((s) => !s.is_warmup)) throw new LiftError('lift_empty');
  return { id: liftId(p.id), lift_day_id: liftId(p.lift_day_id), day_name: text(p.day_name, 100, true),
    day, units: unit(p.units), started_at, finished_at, notes: text(p.notes, 2000), sets };
}
async function rpc(db: SupabaseClient, name: string, args: Obj) {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    if (error.message === 'lift_conflict') throw new LiftError('lift_conflict', 409);
    if (error.message === 'lift_not_owned') throw new LiftError('not_found', 404);
    if (error.code === 'PGRST202' || error.code === '42P01') throw new LiftError('lift_unavailable', 503);
    throw new LiftError('lift_write_failed', 500);
  }
  return data;
}
export async function handleLift(db: SupabaseClient, me: { id: string; tz: string }, action: string, body: Obj) {
  switch (action) {
    case 'lift_state': return rpc(db, 'get_lift_state', { p_person: me.id });
    case 'lift_plan_save': {
      const payload = validateLiftPlan(body.plan);
      await rpc(db, 'save_lift_plan', { p_person: me.id, p_payload: payload });
      return rpc(db, 'get_lift_state', { p_person: me.id });
    }
    case 'lift_session_save': return rpc(db, 'save_lift_session', { p_person: me.id, p_payload: validateLiftSession(body.session, me.tz) });
    case 'lift_history': {
      const exercise = body.exercise_id == null ? null : liftId(body.exercise_id);
      const cursor = body.cursor == null ? null : object(body.cursor);
      const items = await rpc(db, 'get_lift_history', { p_person: me.id, p_exercise: exercise,
        p_before: cursor ? stamp(cursor.at) : null, p_before_id: cursor ? liftId(cursor.id) : null });
      const rows = (items ?? []) as Array<{ id: string; finished_at: string }>;
      const more = rows.length > 20, page = rows.slice(0, 20), last = page[page.length - 1];
      return { items: page, next: more ? { at: last.finished_at, id: last.id } : null };
    }
    case 'lift_session_delete': {
      const { data, error } = await db.from('lift_sessions').delete().eq('id', liftId(body.id)).eq('person_id', me.id).select('id');
      if (error) throw new LiftError('lift_write_failed', 500);
      if (!data?.length) throw new LiftError('not_found', 404);
      return { ok: true };
    }
    default: throw new LiftError('unknown_action');
  }
}
