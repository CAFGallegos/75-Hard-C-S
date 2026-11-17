import {sheet} from './util.js';
import {store} from './store.js';
import {resolveIllustration} from './lift-visuals.js';
import {loadCatalog} from './lift-catalog.js';
const groups={abdominals:['abs'],abductors:['abductors'],adductors:['adductors'],biceps:['biceps'],calves:['calves'],chest:['chest'],forearms:['forearm'],glutes:['gluteal'],hamstrings:['hamstring'],lats:['upper-back'],'lower back':['lower-back'],'middle back':['upper-back'],neck:['neck'],quadriceps:['quadriceps'],shoulders:['deltoids'],traps:['trapezius'],triceps:['triceps']};
export function muscleTargets(exercises,catalog){
 const primary=new Set(),secondary=new Set();let unmatched=0;
 for(const e of exercises){const match=resolveIllustration(e,catalog);const row=['confirmed','matched'].includes(match.kind)?match.row:null;const p=e.details?.primaryMuscles??row?.primaryMuscles??[],s=e.details?.secondaryMuscles??row?.secondaryMuscles??[];if(!p.length)unmatched++;p.forEach(m=>(groups[m]??[]).forEach(x=>primary.add(x)));s.forEach(m=>(groups[m]??[]).forEach(x=>secondary.add(x)));}
 primary.forEach(m=>secondary.delete(m));return {primary:[...primary],secondary:[...secondary],unmatched};
}
let paths;
export async function paintMuscles(host,exercises,expanded=false){
 host.innerHTML='<p class="small">Loading muscle map…</p>';
 try{
 const [catalog,data]=await Promise.all([loadCatalog(),paths??=fetch(new URL('./muscle-paths.json',import.meta.url)).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{paths=null;throw e;})]);
 if(!host.isConnected)return;
 const target=muscleTargets(exercises,catalog);const appearance=store.me.id==='sue'?'female':'male';
 const paint=()=>{
 host.innerHTML='<div class="lift-muscle-heading"><span class="eyebrow">Target muscles</span></div><div class="lift-muscle-pair"></div><p class="small">● Primary · <span class="lift-muscle-secondary">▧ Secondary</span></p><details><summary>Muscle details</summary><p class="small">Catalog muscle groups; not measured activation. Unconfirmed variants are omitted.'+(target.unmatched?' '+target.unmatched+' unmatched exercise(s).':'')+'</p><p class="small" data-muscle-labels></p></details>';
 host.querySelector('[data-muscle-labels]').textContent='Primary: '+(target.primary.join(', ')||'Not mapped')+' · Secondary: '+(target.secondary.join(', ')||'None mapped');
 for(const side of ['Front','Back']){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',appearance==='male'?(side==='Front'?'0 0 724 1448':'724 0 724 1448'):(side==='Front'?'-50 -40 734 1538':'756 0 774 1448'));svg.setAttribute('role','img');svg.setAttribute('aria-label',appearance+' '+side.toLowerCase()+' muscle targets');
 const defs=document.createElementNS(svg.namespaceURI,'defs');const pattern=document.createElementNS(svg.namespaceURI,'pattern');const id='muscle-hatch-'+crypto.randomUUID();pattern.setAttribute('id',id);pattern.setAttribute('width','14');pattern.setAttribute('height','14');pattern.setAttribute('patternUnits','userSpaceOnUse');const stripe=document.createElementNS(svg.namespaceURI,'path');stripe.setAttribute('d','M0 0L14 14M-7 7L7 21M7 -7L21 7');stripe.setAttribute('class','muscle-stripe');pattern.append(stripe);defs.append(pattern);svg.append(defs);
 for(const part of data['body'+(appearance==='female'?'Female':'')+side])for(const d of Object.values(part.path).flat()){
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);const kind=target.primary.includes(part.slug)?'primary':target.secondary.includes(part.slug)?'secondary':'neutral';path.setAttribute('class','muscle-'+kind);if(kind==='secondary')path.setAttribute('fill','url(#'+id+')');const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=part.slug+' · '+kind;path.append(title);svg.append(path);
 }host.querySelector('.lift-muscle-pair').append(svg);
 }

 if(!expanded){
   const pair=host.querySelector('.lift-muscle-pair');
   const button=document.createElement('button');button.className='lift-muscle-icon';button.type='button';button.setAttribute('aria-label','Show target muscles and workout context');button.setAttribute('aria-haspopup','dialog');button.append(pair);host.replaceChildren(button);
   button.onclick=()=>{const panel=sheet('<div class="lift-form"><h2 class="h2">Target muscles</h2><div data-expanded-muscles></div><button class="btn btn-line btn-block" data-close-muscles>Close</button></div>');panel.el.querySelector('[data-close-muscles]').onclick=()=>panel.close();paintMuscles(panel.el.querySelector('[data-expanded-muscles]'),exercises,true);};
 }
 };paint();
 }catch{if(host.isConnected)host.innerHTML='<p class="small">Muscle map unavailable offline. Exercise logging is ready.</p>';}
}
