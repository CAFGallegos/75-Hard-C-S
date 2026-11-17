import {loadCatalog, mediaUrl, equipmentName} from './lift-catalog.js';
import {icon} from './icons.js';

// Presentation only: aliases never assign catalog_id or affect performance identity.
// Unspecified grips/attachments/apparatus are explicitly illustrative, not confirmed.
const aliases = {
  'Incline Bench Press, Barbell': ['barbell', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Medium grip shown; your grip is unconfirmed.'],
  'Bench Press, Wide Grip, Barbell': ['barbell', 'Wide-Grip_Barbell_Bench_Press'],
  'Shoulder Press, Machine': ['machine', 'Leverage_Shoulder_Press', 'Leverage machine shown; confirm your apparatus.'],
  'Dips, Weighted': ['bodyweight', 'Dips_-_Triceps_Version', 'Triceps-style bodyweight dip shown; added load is not illustrated.'],
  'Dips': ['bodyweight', 'Dips_-_Triceps_Version', 'Triceps-style dip shown; your technique is unconfirmed.'],
  'Overhead Triceps Extensions, Cable': ['cable', 'Cable_Rope_Overhead_Triceps_Extension', 'Rope attachment shown; your attachment is unconfirmed.'],
  'Pullovers with Rope, Cable': ['cable', 'Rope_Straight-Arm_Pulldown', 'Straight-arm pulldown shown; confirm the intended movement.'],
  'Lateral Raises, Dumbbells': ['dumbbell', 'Side_Lateral_Raise'],
  'Reverse Flys, Cable': ['cable', 'Cable_Rear_Delt_Fly', 'Catalog cable setup shown; confirm your setup.'],
  'Curls, Cable': ['cable', 'Standing_Biceps_Cable_Curl', 'Standing cable curl shown; confirm stance and attachment.'],
  'Cable Curls': ['cable', 'Standing_Biceps_Cable_Curl', 'Standing cable curl shown; confirm stance and attachment.'],
  'Seated Leg Curls': ['machine', 'Seated_Leg_Curl'],
  'Calf Raises on Leg Press': ['machine', 'Calf_Press_On_The_Leg_Press_Machine'],
  'Lat Pulldowns, Wide Overhand Grip': ['cable', 'Wide-Grip_Lat_Pulldown'],
};
export function resolveIllustration(exercise, catalog, selectedId) {
  const find = id => catalog.find(row => row.id === id);
  if (selectedId) return {row:find(selectedId), kind:'chosen', note:'Chosen illustration · '+(find(selectedId)?.name??'Unavailable')+' · exercise identity unchanged.'};
  if (exercise.details?.catalog_id) return {row:find(exercise.details.catalog_id), kind:'confirmed', note:'Exercise demonstration'};
  const exact = catalog.filter(row => row.name.toLowerCase() === exercise.name.toLowerCase() && equipmentName(row) === exercise.equipment);
  if (exact.length === 1) return {row:exact[0], kind:'matched', note:'Matching illustration · '+exact[0].name};
  const alias = aliases[exercise.name];
  if (alias && alias[0] === exercise.equipment) return {row:find(alias[1]), kind:alias[2]?'approximation':'matched', note:alias[2]?'Illustrative approximation · '+alias[2]:'Matching illustration · '+find(alias[1])?.name};
  return {row:null, kind:'missing', note:'No confirmed illustration for this variant.'};
}
export function illustrationUrl(path) {
  return /^icons\/exercises\/[A-Za-z0-9_()-]+\.jpg$/.test(path) ? path : mediaUrl(path);
}
let localMedia;
async function localPhotos() {
  localMedia ??= Promise.all(['exercise-data.json','lift-media.json'].map(name=>fetch(new URL('./'+name, import.meta.url)).then(r => {if(!r.ok)throw Error();return r.json();}))).then(rows=>rows.flat()).catch(()=>{localMedia=null;return [];});
  return localMedia;
}
export async function paintWorkoutImages(root, exercises, choices = {}) {
  const hosts = [...root.querySelectorAll('[data-workout-image]')];
  try {
    const [catalog, local] = await Promise.all([loadCatalog(), localPhotos()]);
    for (const host of hosts) {
      if (!host.isConnected) continue;
      const exercise = exercises[Number(host.dataset.workoutImage)];
      const match = resolveIllustration(exercise, catalog, choices[exercise.runtime_id]);
      const gallery = host.classList.contains('lift-active-photos');
      const caption = gallery && host.parentElement.querySelector('[data-illustration-caption]');
      if(caption) caption.textContent = match.note;
      const row = match.row;
      const paths = (local.find(e=>e.id===row?.id)?.images ?? row?.images ?? []).slice(0, gallery?2:1).map(illustrationUrl).filter(Boolean);
      host.setAttribute('aria-busy','false');
      if (!paths.length) {host.classList.add('no-photo');host.innerHTML=icon('workout')+(gallery?'<span>No photo available · choose an illustration below</span>':'');continue;}
      host.replaceChildren();host.classList.remove('no-photo');
      for (const [i, src] of paths.entries()) {
        const frame = document.createElement('span');frame.className='lift-photo-frame';
        const img = new Image();img.alt=gallery?`${row.name}, position ${i+1}`:'';img.width=240;img.height=240;
        img.loading=gallery?'eager':'lazy';img.decoding='async';img.referrerPolicy='no-referrer';
        const status=document.createElement('span');status.className='lift-photo-status';status.textContent='Loading…';
        img.onload=()=>status.remove();
        img.onerror=()=>{frame.classList.add('no-photo');frame.innerHTML=icon('workout')+'<span>Photo unavailable · offline or missing</span>';};
        img.src=src;frame.append(img,status);host.append(frame);
      }
    }
  } catch {
    for (const host of hosts) if(host.isConnected){host.setAttribute('aria-busy','false');host.classList.add('no-photo');host.innerHTML=icon('workout')+(host.classList.contains('lift-active-photos')?'<span>Photos unavailable offline · your sets are ready</span>':'');}
  }
}

// Scroll only the strip, never the page or a focused input.
export function revealCurrentTile(root) {
  const tile=root.querySelector('.lift-photo-tab.is-current');
  if(!tile)return;
  const rail=tile.parentElement, item=tile.getBoundingClientRect(), bounds=rail.getBoundingClientRect();
  if(item.left<bounds.left)rail.scrollLeft-=bounds.left-item.left+2;
  else if(item.right>bounds.right)rail.scrollLeft+=item.right-bounds.right+2;
}
