// Bodyweight is separate from exercise loads and completed workout history.
const validUnits = units => units === 'lb' || units === 'kg';
export function weightIn(value, from, to) {
  if (!validUnits(from) || !validUnits(to)) throw new Error('Choose lb or kg.');
  return from === to ? value : from === 'lb' ? value * 0.45359237 : value / 0.45359237;
}
export function validateWeighIn(entry, today = '9999-12-31') {
  const {day, weight, units} = entry ?? {};
  if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day) || !Number.isFinite(Date.parse(day+'T12:00:00Z')) || new Date(day+'T12:00:00Z').toISOString().slice(0,10) !== day || day > today) throw new Error('Choose a valid date, today or earlier.');
  if (!validUnits(units) || typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weightIn(weight, units, 'kg') > 650) throw new Error('Enter a weight above zero, up to 650 kg / 1433 lb.');
  return {day, weight, units};
}
function key(namespace) {
  if (!/^weight-v1:[a-f0-9]{64}$/.test(namespace ?? '')) throw new Error('Open your private app before logging weight.');
  return namespace+':bodyweight-v1';
}
export function readWeights(storage, namespace) {
  const raw = storage.getItem(key(namespace));
  if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.entries)) throw Error();
    const entries = data.entries.map(entry=>validateWeighIn(entry));
    if (new Set(entries.map(e=>e.day)).size !== entries.length) throw Error();
    return entries.sort((a,b)=>a.day.localeCompare(b.day));
  } catch { throw new Error('Saved weights could not be read. Keep this browser’s data; no entries were changed.'); }
}
export function writeWeight(storage, namespace, entry, today) {
  const valid = validateWeighIn(entry, today);
  const entries = readWeights(storage, namespace).filter(e=>e.day !== valid.day);
  entries.push(valid);entries.sort((a,b)=>a.day.localeCompare(b.day));
  storage.setItem(key(namespace), JSON.stringify({version:1, entries}));
  return entries;
}
export function removeWeight(storage, namespace, day) {
  const entries = readWeights(storage, namespace).filter(e=>e.day !== day);
  storage.setItem(key(namespace), JSON.stringify({version:1, entries}));
  return entries;
}
export function weightSummary(entries, units) {
  const sorted = [...entries].sort((a,b)=>a.day.localeCompare(b.day));
  const latest = sorted.at(-1), previous = sorted.at(-2);
  return {latest: latest ? weightIn(latest.weight, latest.units, units) : null, change: previous ? weightIn(latest.weight, latest.units, units)-weightIn(previous.weight, previous.units, units) : null, day: latest?.day, previousDay:previous?.day};
}
export function weightsCsv(entries) {
  return 'date,weight,unit\r\n'+entries.map(e=>{const v=validateWeighIn(e);return `${v.day},${v.weight},${v.units}\r\n`;}).join('');
}

export async function weightNamespace(privateKey) {
  if (!privateKey) throw new Error('Open your private app before logging weight.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(privateKey));
  return 'weight-v1:'+Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,'0')).join('');
}
export function weightSettings(storage, namespace) {
  const raw = storage.getItem(key(namespace)+':settings');
  if (raw === null) return {enabled:false, units:'lb'};
  try {const settings=JSON.parse(raw);if(typeof settings.enabled!=='boolean'||!validUnits(settings.units))throw Error();return {enabled:settings.enabled,units:settings.units};}
  catch {throw new Error('Weight settings could not be read. No settings were changed.');}
}
export function saveWeightSettings(storage, namespace, settings) {
  if(typeof settings.enabled!=='boolean'||!validUnits(settings.units))throw new Error('Check weight settings.');
  storage.setItem(key(namespace)+':settings',JSON.stringify({enabled:settings.enabled,units:settings.units}));
}
