import {catalogUsage} from './lift-analytics.js';
import { $, esc, sheet, toast } from './util.js';
import { loadCatalog, filterCatalog, equipmentName, exerciseGuidance, mediaUrl, CATALOG_SOURCE, CATALOG_REVISION } from './lift-catalog.js';
import { replacementCandidates } from './lift-generator.js';
import { store } from './store.js';
let lift, savePlan;
async function context(){ ({lift,savePlan}=await import('./lift-store.js')); }
import { EQUIPMENT } from './lift-domain.js';
export function filterExercises(rows,query='',equipment=''){return filterCatalog(rows,query,{equipment});}
async function rows(){await context();return [...await loadCatalog(),...(lift.state?.plan.details?.custom??[])];}
function loadAlternatives(host,e,catalog){
 if(!host||host.dataset.loaded)return;host.dataset.loaded='1';
 const guide=exerciseGuidance(e),preferences=lift.state?.plan.details?.preferences??{};
 const alternatives=replacementCandidates({equipment:equipmentName(e),details:{catalog_id:e.id,primaryMuscles:e.primaryMuscles}},catalog,{...preferences,favorites:lift.state?.plan.details?.favorites??[]});
 host.innerHTML=`<p class="small">${esc(guide.pattern)}</p><p class="small">${esc(guide.reps)}</p><h3 class="h3">Alternatives to review</h3><p class="small">Shared muscle metadata and saved preferences; not interchangeable loads or medical clearance. Opening a reference does not change your workout.</p>${alternatives.length?alternatives.map(x=>`<button type="button" class="btn btn-line btn-block" data-alternative-reference="${esc(x.exercise.id)}">${esc(x.exercise.name)}</button>`).join(''):'<p class="small">No matching alternatives under your current preferences. Search the library to review other movements.</p>'}`;
 host.onclick=ev=>{const b=ev.target.closest('[data-alternative-reference]');if(!b)return;ev.stopPropagation();const row=catalog.find(x=>x.id===b.dataset.alternativeReference);if(row)showReference({name:row.name,details:{catalog_id:row.id}});};
}
function info(e){return `<p class="small">${e.id.startsWith('custom-')?'Your custom exercise · no upstream mapping':'Free Exercise DB · pinned source ID: '+esc(e.id)}</p><p class="small">${esc(equipmentName(e))} · ${esc(e.level??'Difficulty not specified')} · ${esc(e.category??'Category not specified')} · ${esc(e.mechanic??'Mechanic not specified')} · ${esc(e.force??'Force not specified')}</p><p class="small">Primary: ${esc(e.primaryMuscles.join(', ')||'Not specified')}<br>Secondary: ${esc(e.secondaryMuscles.join(', ')||'Not specified')}</p><div class="lift-library-images" data-media="${esc(e.id)}"></div><ol>${e.instructions.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${e.instructions.length?'':'<p class="small">No instructions supplied. Add notes to your custom movement.</p>'}<div data-alternatives></div>`;}
function loadMedia(host,e){
 if(!host||host.dataset.loaded)return;host.dataset.loaded='1';
 if(!e.images.length){host.innerHTML='<p class="small">No demonstration image available. Logging still works.</p>';return;}
 e.images.forEach((path,i)=>{const src=path.startsWith('icons/exercises/')?path:mediaUrl(path);if(!src)return;const figure=document.createElement('figure');const img=new Image();img.width=240;img.height=240;img.loading='lazy';img.alt=`${e.name} demonstration ${i+1}`;img.referrerPolicy='no-referrer';img.crossOrigin='anonymous';img.onerror=()=>{figure.textContent='Image unavailable. Use the instructions; your workout is unaffected.';figure.className='small';};img.src=src;figure.append(img);host.append(figure);});
}
async function updateDetails(patch){
 await context();
 if(!lift.state)throw new Error('Open Lift before saving library changes.');
 if(lift.edit?._dirty)throw new Error('Save or reload your unsaved plan before saving library preferences.');
 await savePlan({...lift.state.plan,days:lift.state.days,details:{...lift.state.plan.details,...patch}});
}
export async function mountLibrary(root,choose,initial=''){
 root.innerHTML='<p role="status">Loading exercise library…</p>';
 try{
  const catalog=await rows();if(!root.isConnected)return;
  let limit=30; let usage={};
  try{let cursor=null,history=[];do{const page=await store.api('lift_history',{cursor});history.push(...page.items);cursor=page.next;if(history.length>5000)throw new Error('History too large');}while(cursor);usage=catalogUsage(history);}catch{usage=null;}
  const favorites=()=>lift.state?.plan.details?.favorites??[];
  root.innerHTML=`<p class="small">${catalog.filter(e=>!e.id.startsWith('custom-')).length} catalog exercises + ${catalog.filter(e=>e.id.startsWith('custom-')).length} custom · <a href="${CATALOG_SOURCE}" target="_blank" rel="noopener noreferrer">Free Exercise DB</a> · Unlicense / public domain. Photos load when opened. Revision ${CATALOG_REVISION.slice(0,7)}. <a href="icons/exercises/SOURCE.md" target="_blank" rel="noopener noreferrer">Source and license</a>.</p><label class="lift-field"><span>Search name, aliases or muscles</span><input type="search" data-search value="${esc(initial)}"></label><div class="lift-fields"><label class="lift-field"><span>Equipment</span><select data-equipment><option value="">All equipment</option>${[...new Set(catalog.map(equipmentName))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label class="lift-field"><span>Muscle</span><select data-muscle><option value="">All muscles</option>${[...new Set(catalog.flatMap(e=>[...e.primaryMuscles,...e.secondaryMuscles]))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label class="lift-field"><span>Difficulty</span><select data-level><option value="">All levels</option>${['beginner','intermediate','expert'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="lift-field"><span>Category</span><select data-category><option value="">All categories</option>${[...new Set(catalog.map(e=>e.category).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label></div><label class="small"><input type="checkbox" data-only-favorites> Favorites only</label><button type="button" class="btn btn-line btn-block" data-custom>Create custom exercise</button><label class="lift-field"><span>Sort</span><select data-sort><option value="name">Name</option><option value="favorites">Favorites first</option><option value="usage" ${usage?'':'disabled'}>Most used · saved sessions</option></select></label><div data-results></div>`;
  const paint=()=>{
   const matches=filterCatalog(catalog,$('[data-search]',root).value,{equipment:$('[data-equipment]',root).value,muscle:$('[data-muscle]',root).value,level:$('[data-level]',root).value,category:$('[data-category]',root).value,favorites:$('[data-only-favorites]',root).checked?favorites():null});
   const sort=$('[data-sort]',root).value;matches.sort((a,b)=>(sort==='usage'?(usage[b.id]??0)-(usage[a.id]??0):sort==='favorites'?Number(favorites().includes(b.id))-Number(favorites().includes(a.id)):0)||a.name.localeCompare(b.name));
   const body=$('[data-results]',root);
   body.innerHTML=`<p class="small" role="status">${matches.length} matches · showing ${Math.min(limit,matches.length)}</p>`+matches.slice(0,limit).map(e=>`<details class="card card-pad lift-library-item" data-info="${esc(e.id)}"><summary><span class="lift-thumb" data-thumbnail="${esc(e.id)}"></span><span>${esc(e.name)}<small class="small"> · ${esc(equipmentName(e))}${usage?` · ${usage[e.id]??0} saved sessions`: ''}</small></span></summary>${info(e)}<div class="lift-actions"><button type="button" class="btn btn-line" data-fav="${esc(e.id)}" aria-pressed="${favorites().includes(e.id)}">${favorites().includes(e.id)?'Unfavorite':'Favorite'}</button>${choose?`<button type="button" class="btn btn-me" data-pick="${esc(e.id)}">Use this exercise</button>`:''}</div></details>`).join('')+(matches.length>limit?'<button type="button" class="btn btn-line btn-block" data-more-library>Show more</button>':'')+(!matches.length?'<p class="body">No match. Try fewer words or create a custom exercise.</p>':'');
   body.querySelectorAll('[data-thumbnail]').forEach(el=>{const e=catalog.find(x=>x.id===el.dataset.thumbnail);if(e.images[0]){const img=new Image();img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=e.images[0].startsWith('icons/')?e.images[0]:mediaUrl(e.images[0]);img.onerror=()=>{el.textContent='—';};el.append(img);}else el.textContent='—';});
   body.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',()=>{if(el.open){const e=catalog.find(e=>e.id===el.dataset.info);loadMedia($('[data-media]',el),e);loadAlternatives($('[data-alternatives]',el),e,catalog);}}));
  };
  root.querySelectorAll('input,select').forEach(el=>el.addEventListener(el.type==='search'?'input':'change',()=>{limit=30;paint();}));
  $('[data-results]',root).onclick=async ev=>{const b=ev.target.closest('button');if(!b)return;try{if(b.dataset.pick&&choose)return await choose(catalog.find(e=>e.id===b.dataset.pick));if(b.hasAttribute('data-more-library')){limit+=30;paint();}if(b.dataset.fav){b.disabled=true;await updateDetails({favorites:favorites().includes(b.dataset.fav)?favorites().filter(x=>x!==b.dataset.fav):[...favorites(),b.dataset.fav]});b.disabled=false;b.setAttribute('aria-pressed',String(favorites().includes(b.dataset.fav)));b.textContent=favorites().includes(b.dataset.fav)?'Unfavorite':'Favorite';}}catch(err){b.disabled=false;toast(err.message,{error:true});}};
  $('[data-custom]',root).onclick=()=>customEditor(async e=>{await updateDetails({custom:[...(lift.state.plan.details?.custom??[]),e]});catalog.push(e);paint();if(choose)await choose(e);});
  paint();
 }catch(err){root.innerHTML=`<p role="status">${esc(err.message)} Your workout is safe; custom plan entry still works.</p><button type="button" class="btn btn-line" data-retry-library>Retry</button>`;$('[data-retry-library]',root).onclick=()=>mountLibrary(root,choose,initial);}
}
function customEditor(save){
 // Keep the library underneath while using the existing sheet component.
 const s=sheet(`<form class="lift-form"><h2 class="h2">Custom exercise</h2><label class="lift-field"><span>Name</span><input name="name" required maxlength="120"></label><label class="lift-field"><span>Equipment</span><select name="equipment">${EQUIPMENT.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="lift-field"><span>Primary muscles (comma separated; optional)</span><input name="muscles" maxlength="200"></label><label class="lift-field"><span>Instructions / restrictions</span><textarea name="instructions" maxlength="2000"></textarea></label><button class="btn btn-me btn-block" type="submit">Save custom exercise</button></form>`);
 $('form',s.el).onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);const b=$('button',s.el);b.disabled=true;try{await save({id:`custom-${crypto.randomUUID()}`,name:String(f.get('name')).trim(),equipment:f.get('equipment'),primaryMuscles:String(f.get('muscles')).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),secondaryMuscles:[],instructions:String(f.get('instructions')).trim()?[String(f.get('instructions'))]:[],images:[],category:'strength',level:null});s.close();}catch(err){b.disabled=false;toast(err.message,{error:true});}};
}
export function showLibrary(initial=''){
 const s=sheet('<div class="lift-form"><h2 class="h2">Exercise library</h2><div data-library></div><button type="button" class="btn btn-line btn-block" data-close-library>Close</button></div>');
 $('[data-close-library]',s.el).onclick=()=>s.close();mountLibrary($('[data-library]',s.el),null,initial);
}
export async function showReference(exercise){
 const s=sheet(`<div class="lift-form"><h2 class="h2">${esc(exercise.name)}</h2><div data-reference></div><button class="btn btn-line btn-block" data-reference-close>Back to workout</button></div>`);
 $('[data-reference-close]',s.el).onclick=()=>s.close();
 try{const catalog=await rows(),row=catalog.find(e=>e.id===exercise.details?.catalog_id);if(!s.el.isConnected)return;const host=$('[data-reference]',s.el);host.innerHTML=row?info(row):`<p class="body">Custom / unmatched movement. No catalog mapping confirmed.</p><p class="small">Equipment: ${esc(exercise.equipment)} · ${esc(exercise.details?.load_type??'external')} load</p><p class="body">${esc(exercise.notes??'')}</p>`;if(row){loadMedia($('[data-media]',host),row);loadAlternatives($('[data-alternatives]',host),row,catalog);}}catch{$('[data-reference]',s.el).textContent='Reference unavailable. Your entered sets and timer are unchanged.';}
}
