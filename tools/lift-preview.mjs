// Local-only sample API and static server. No outbound network calls.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { validateLiftPlan, validateLiftSession, validateBackup } from '../supabase/functions/_shared/lift-schema.js';
import { mergeBackups } from '../js/lift-backup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const clone = structuredClone;
const samples = new Map();
function sample(key) {
  if (samples.has(key)) return samples.get(key);
  const person = key === 'sample-b' ? 'sue' : 'los';
  const people = ['los', 'sue'].map((pid) => ({ id: pid, name: pid === 'los' ? 'Sample Alex' : 'Sample Sam', tz: 'America/Chicago', today: today(), diet: 'Sample balanced meals', entries: [], daily_line: 'Sample data. One set at a time.' }));
  const exercise = { id: id(person === 'los' ? 2 : 12), name: 'Sample bench press', sets: 3, rep_min: 8, rep_max: 12, target_rir: 2, equipment: 'barbell', increment: 5, rest_seconds: null, notes: 'Sample exercise — adjust the weight to try the inputs.', details: { catalog_id:'Barbell_Bench_Press_-_Medium_Grip', mechanic:'compound', load_type:'external', apparatus:'Sample bench', primaryMuscles:['chest'], secondaryMuscles:['triceps','shoulders'] } };
  const days = [{ id: id(person === 'los' ? 1 : 11), name: 'Sample upper body', exercises: [exercise] }];
  const plan = { details: {}, units: 'lb', default_rest_seconds: 120, bar_weight: 45, plates: [45, 25, 10, 5, 2.5], version: 0 };
  const sessions = Array.from({ length: 23 }, (_, i) => {
    const finished = new Date(Date.now() - (i + 1) * 86400000);
    return { id: id((person === 'los' ? 100 : 200) + i), lift_day_id: days[0].id, day: finished.toISOString().slice(0, 10), day_name: days[0].name, units: 'lb', notes: 'Sample workout history', started_at: new Date(+finished - 3600000).toISOString(), finished_at: finished.toISOString(), sets: [1, 2, 3].map((set_no) => ({ exercise_id: exercise.id, exercise_name: exercise.name, exercise_notes: '', set_no, is_warmup: false, weight: Math.max(45, 135 - i * 5), reps: 12, rir: 2, details: exercise.details })) };
  });
  const data = { known_days:new Set(days.map(d=>d.id)), challenge: { start_date: today(), miss_penalty: 1, people, me: { ...people.find((p) => p.id === person), onboarded: true, photo_mode: 'manual', photo_count: 0, push_devices: 0, reminders: {} }, nudges: { partner_on: false, remaining: 3 } }, plan, days, sessions, catalog: [{ id: exercise.id, name: exercise.name, archived: false }] };
  samples.set(key, data); return data;
}
function state(s) {
  return { plan: s.plan, days: s.days, catalog: s.catalog, last_day_id: s.sessions[0]?.lift_day_id ?? null, recent: Object.fromEntries(s.catalog.map((e) => [e.id, s.sessions.filter((x) => x.sets.some((set) => set.exercise_id === e.id && !set.is_warmup)).slice(0, 6).map((x) => ({ ...x, sets: x.sets.filter((set) => set.exercise_id === e.id) }))])) };
}
export function mockCall(body) {
  if (!['sample-a', 'sample-b'].includes(body.k)) throw new Error('bad_key');
  const s = sample(body.k);
  switch (body.a) {
    case 'lift_backup_export': return validateBackup({ format:'75hard-lift',version:1,owner:s.challenge.me.id,revision:createHash('md5').update(s.plan.version+s.sessions.map(x=>x.id).sort().join(',')).digest('hex'),exported_at:new Date().toISOString(),plan:{...s.plan,days:s.days},sessions:s.sessions },s.challenge.me.id);
    case 'lift_backup_import': {
      if(body.version!==s.plan.version)throw new Error('lift_conflict');
      const current=mockCall({k:body.k,a:'lift_backup_export'});
      if(body.revision!==current.revision)throw new Error('lift_conflict');
      const imported=mergeBackups(current,body.backup,body.mode);
      const {days,...plan}=imported.plan;
      s.plan={...plan,version:s.plan.version+1};s.days=days;s.sessions=imported.sessions;
      s.catalog.forEach(e=>e.archived=true);days.forEach(d=>{s.known_days.add(d.id);d.exercises.forEach(e=>{const old=s.catalog.find(x=>x.id===e.id);if(old)Object.assign(old,{name:e.name,details:e.details,archived:false});else s.catalog.push({id:e.id,name:e.name,details:e.details,archived:false});});});
      return clone(state(s));
    }
    case 'state': return clone(s.challenge);
    case 'lift_state': return clone(state(s));
    case 'lift_plan_save': {
      const p = validateLiftPlan(body.plan);
      if (p.version !== s.plan.version) throw new Error('lift_conflict');
      s.days = p.days; p.days.forEach(d=>s.known_days.add(d.id)); const { days, ...plan } = p; s.plan = { ...plan, version: p.version + 1 };
      s.catalog.forEach((e) => e.archived = true);
      for (const d of days) for (const e of d.exercises) {
        const old = s.catalog.find((x) => x.id === e.id);
        if (old) Object.assign(old, { name: e.name, details:e.details, archived: false });
        else s.catalog.push({ id: e.id, name: e.name, details:e.details, archived: false });
      }
      return clone(state(s));
    }
    case 'lift_session_save': {
      const session = validateLiftSession(body.session, 'America/Chicago');
      if(session.lift_day_id && !s.known_days.has(session.lift_day_id))throw new Error('not_found');
      if(session.sets.some(x=>x.exercise_id && !s.catalog.some(e=>e.id===x.exercise_id)))throw new Error('not_found');
      if (!s.sessions.some((x) => x.id === session.id)) s.sessions.unshift(session);
      return { id: session.id, saved: true };
    }
    case 'lift_history': {
      const rows = s.sessions.filter((x) => !body.exercise_id || x.sets.some((set) => set.exercise_id === body.exercise_id));
      const start = body.cursor ? rows.findIndex((x) => x.id === body.cursor.id) + 1 : 0;
      const items = clone(rows.slice(start, start + 20));
      if (body.exercise_id) items.forEach((x) => x.sets = x.sets.filter((set) => set.exercise_id === body.exercise_id));
      const last = items.at(-1);
      return { items, next: start + 20 < rows.length ? { id: last.id, at: last.finished_at } : null };
    }
    case 'lift_session_delete': if(!s.sessions.some(x=>x.id===body.id))throw new Error('not_found');s.sessions = s.sessions.filter((x) => x.id !== body.id); return { ok: true };
    case 'set': {
      const me = s.challenge.people.find((p) => p.id === s.challenge.me.id);
      let entry = me.entries.find((e) => e.day === body.day);
      if (!entry) { entry = { day: body.day, water: 0, w1: false, w2: false, diet: false, read: false, photo: false }; me.entries.push(entry); }
      Object.assign(entry, body.fields); return clone(s.challenge);
    }
    case 'photos': return { photos: [] };
    default: throw new Error('preview_unsupported'); // Never forward unmocked actions.
  }
}
export function previewRoutineSource(source) {
  // Never send the supplied personal numbers or source dates to a shared preview.
  // Keep five-session navigation and load semantics, but use synthetic set values.
  const synthetic=[['Push A','Sample press','barbell','external'],['Pull A','Sample pull-up','bodyweight','bodyweight'],['Legs','Sample leg press','machine','external'],['Push B','Sample added-load dip','bodyweight','added'],['Pull B','Sample cable row','cable','external']].map(([name,movement,equipment,load_type])=>({name,source:'SYNTHETIC SAMPLE ONLY',exercises:[{name:movement,equipment,load_type,values:[[load_type==='bodyweight'?0:20,10,'5+'],[load_type==='bodyweight'?0:25,8,1.5]]}]}));
  return source.replace(/export const ROUTINE_FLAGS=\[[\s\S]*?\];/, 'export const ROUTINE_FLAGS=["SYNTHETIC SAMPLE: these values are invented for preview testing, never your real starting references."];')
    .replace(/export const ROUTINE = \[[\s\S]*?\];(?=\s*export function startingRoutine)/,`export const ROUTINE = ${JSON.stringify(synthetic)};`);
}
function authorized(req) {
  const password=process.env.LIFT_PREVIEW_PASSWORD;
  if(!password)return true;
  const actual=Buffer.from(req.headers.authorization??'');
  const expected=Buffer.from('Basic '+Buffer.from('preview:'+password).toString('base64'));
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const previewCsp = "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'none'; object-src 'none'; form-action 'self'; base-uri 'self'";
export const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', previewCsp);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(!authorized(req)){res.setHeader('WWW-Authenticate','Basic realm="Temporary Lift sample", charset="UTF-8"');res.writeHead(401).end('Preview sign-in required.');return;}
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/__preview_api' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1000000) throw new Error('too_big'); }
      res.setHeader('Content-Type', 'application/json');
      try { res.end(JSON.stringify(mockCall(JSON.parse(raw)))); }
      catch (err) { res.statusCode = 400; res.end(JSON.stringify({ error: err.message })); }
      return;
    }
    if(path.startsWith('/__preview_media/') && req.method==='GET') {
      const media=decodeURIComponent(path.slice('/__preview_media/'.length));
      if(!/^[A-Za-z0-9_()'., -]+\/\d+\.jpg$/.test(media)){res.writeHead(404).end();return;}
      try{const file=await realpath(resolve(root,'icons/exercises',media.replace(/\/(\d+)\.jpg$/,'-$1.jpg')));if(!file.startsWith(resolve(root,'icons/exercises')+'/'))throw new Error('not_found');const data=await readFile(file);res.setHeader('Content-Type','image/jpeg');res.end(data);}catch{res.writeHead(404).end();}return;
    }
    if (req.method !== 'GET' || !/^\/(?:$|supabase\/functions\/_shared\/lift-schema\.js$|index\.html$|manifest\.webmanifest$|(?:js|css|fonts|icons)\/)/.test(path)) { res.writeHead(404).end(); return; }
    const decoded=decodeURIComponent(path);
    if(decoded.split('/').some(x=>x==='.'||x==='..'||x.startsWith('.'))||decoded.includes('\\')){res.writeHead(404).end();return;}
    const file = await realpath(resolve(root, `.${path === '/' ? '/index.html' : decoded}`));
    const allowed=/^\/(?:index\.html|manifest\.webmanifest|supabase\/functions\/_shared\/lift-schema\.js|js\/(?:[a-z0-9-]+\.js|exercise-(?:catalog(?:\.source)?|data)\.json)|js\/views\/[a-z0-9-]+\.js|css\/app\.css|fonts\/[a-z0-9-]+\.woff2|icons\/[a-z0-9-]+\.png|icons\/exercises\/(?:[A-Za-z0-9_()-]+\.jpg|SOURCE\.md|LICENSE\.txt))$/;
    if(!allowed.test(path==='/'?'/index.html':decoded)){res.writeHead(404).end();return;}
    if (!file.startsWith(root) || /(?:^|\/)\./.test(path.slice(1))) { res.writeHead(404).end(); return; }
    let content = await readFile(file);
    if (path === '/js/lift-routine.js') content=previewRoutineSource(content.toString());
    if (path === '/js/config.js') content = 'export const API_URL = "/__preview_api"; export const SHORTCUT_NAME = "Sample preview only";';
    if (path === '/js/lift-catalog.js') content=content.toString().replace(/export const MEDIA_BASE=.*?;/, 'export const MEDIA_BASE="/__preview_media/";');
    if (path === '/js/app.js') content = content.toString().replace('navigator.serviceWorker.register("sw.js").catch(() => {});', '/* Service worker disabled in local sample preview. */');
    if (path === '/' || path === '/index.html') content = content.toString().replace('<title>75 Hard</title>', '<title>Lift · SAMPLE PREVIEW</title>').replace('<div id="app"', '<div class="lift-notice" role="note" style="margin:12px">SAMPLE PREVIEW · Synthetic data only · Mock API · Do not import real backups or enter real workout data. <a href="/?k=sample-a&amp;tab=lift">Sample Alex</a> · <a href="/?k=sample-b&amp;tab=lift">Sample Sam</a></div><div id="app"').replace('</body>', '<script>if (!new URL(location.href).searchParams.has("k")) location.replace("/?k=sample-a&tab=lift");</script></body>');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream'); res.end(content);
  } catch { res.writeHead(404).end(); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(4175, '127.0.0.1', () => console.log('Sample Lift preview: http://127.0.0.1:4175/?k=sample-a&tab=lift'));
}
