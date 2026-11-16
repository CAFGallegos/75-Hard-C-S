// Validation and private Lift handlers. No challenge state or notification side effects.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

import { LiftError, liftId, stamp, obj as object, validateLiftPlan, validateLiftSession, validateBackup } from './lift-schema.js';
export { LiftError, validateLiftPlan, validateLiftSession, liftId } from './lift-schema.js';
type Obj = Record<string, unknown>;
async function rpc(db: SupabaseClient, name: string, args: Obj) {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    if (error.message === 'lift_backup_too_large') throw new LiftError('lift_backup_too_large', 413);
    if (error.message === 'lift_conflict') throw new LiftError('lift_conflict', 409);
    if (error.message === 'lift_not_owned') throw new LiftError('not_found', 404);
    if (error.code === 'PGRST202' || error.code === '42P01') throw new LiftError('lift_unavailable', 503);
    throw new LiftError('lift_write_failed', 500);
  }
  return data;
}
export async function handleLift(db: SupabaseClient, me: { id: string; tz: string }, action: string, body: Obj) {
  switch (action) {
    case 'lift_backup_export': return rpc(db, 'export_lift_backup', { p_person: me.id });
    case 'lift_backup_import': {
      const backup = validateBackup(body.backup, me.id, me.tz);
      if (typeof body.revision !== 'string' || !/^[a-f0-9]{32}$/.test(body.revision)) throw new LiftError('lift_backup_invalid');
      if (!Number.isInteger(body.version) || Number(body.version) < 0) throw new LiftError('lift_backup_invalid');
      if (body.mode !== 'merge' && body.mode !== 'replace') throw new LiftError('lift_backup_invalid');
      return rpc(db, 'restore_lift_backup', { p_person: me.id, p_backup: backup, p_mode: body.mode, p_version: body.version, p_revision:body.revision });
    }
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
      await rpc(db, 'delete_lift_session', { p_person: me.id, p_id: liftId(body.id) });
      return { ok: true };
    }
    default: throw new LiftError('unknown_action');
  }
}
