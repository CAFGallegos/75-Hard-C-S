import {readWeights, writeWeight, removeWeight, weightIn, weightSummary, weightsCsv, weightNamespace, weightSettings, saveWeightSettings} from './weight-tracker.js';
import {store} from './store.js';
import {$, esc, sheet, confirmSheet} from './util.js';
const number = value => new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(value);
export async function openWeightTracker(onClose) {
  // Capture the current private-link namespace; never use a shared profile key.
  const privateKey=store.k;
  const namespace = await weightNamespace(privateKey);
  if(store.k!==privateKey)return;
  const settings=weightSettings(localStorage,namespace);
  if(!settings.enabled)return;
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:store.me.tz, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  const part = type => parts.find(p=>p.type===type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  let entries, units = settings.units;
  const s=sheet(`<div class="lift-form lift-weight"><h2 class="h2">Body weight</h2><p class="small">Private to ${esc(store.me.name)} · saved on this device only. Export CSV to keep a copy before moving devices.</p><div data-weight-content></div><p class="small" role="status" data-weight-status></p><button class="btn btn-line btn-block" data-weight-close>Close</button></div>`, {onClose});
  $('[data-weight-close]',s.el).onclick=()=>s.close();
  const host=$('[data-weight-content]',s.el), status=$('[data-weight-status]',s.el);
  const fail=error=>{status.textContent=error?.name==='QuotaExceededError'?'This device could not save your weight. Free browser storage and try again.':error.message;};
  try { entries=readWeights(localStorage,namespace); } catch(error) {fail(error);return;}
  host.innerHTML=`<form data-weight-form><div class="lift-fields"><label class="lift-field"><span>Date</span><input type="date" name="day" value="${today}" max="${today}" required></label><label class="lift-field"><span>Unit</span><select name="units"><option value="lb">lb</option><option value="kg">kg</option></select></label></div><label class="lift-field"><span>Body weight</span><input name="weight" type="number" inputmode="decimal" min="0.01" step="any" required placeholder="Enter your weight"></label><button class="btn btn-me btn-block" type="submit" data-save-weight>Save weight</button><p class="small">One entry per date. Saving again updates that date.</p></form><div data-weight-summary></div><div data-weight-chart></div><details class="lift-weight-history"><summary>Weight history</summary><div data-weight-history></div></details><button class="btn btn-line btn-block" data-weight-export>Export CSV</button>`;
  const input=$('[name=weight]',host), date=$('[name=day]',host), select=$('[name=units]',host), save=$('[data-save-weight]',host);
  select.value=units;
  const selectDate=()=>{const entry=entries.find(e=>e.day===date.value);input.value=entry?String(Number(weightIn(entry.weight,entry.units,units).toFixed(2))):'';save.textContent=entry?'Update weight':'Save weight';};
  const paint=()=>{
    const summary=weightSummary(entries,units);
    $('[data-weight-summary]',host).innerHTML=summary.latest===null?'<p class="body">Your first weigh-in starts your trend.</p>':`<section class="card card-pad"><span class="eyebrow">Latest · ${summary.day}</span><p class="h2">${number(summary.latest)} ${units}</p><p class="small">${summary.change===null?'Add another date to see a change.':`${summary.change>0?'+':''}${number(summary.change)} ${units} since ${summary.previousDay}`}</p></section>`;
    const rows=entries.slice(-30), values=rows.map(e=>weightIn(e.weight,e.units,units));
    const min=Math.min(...values), max=Math.max(...values), start=Date.parse(rows[0]?.day??''), end=Date.parse(rows.at(-1)?.day??'');
    const x=e=>20+260*(Date.parse(e.day)-start)/(end-start||1), y=value=>100-70*(value-min)/(max-min||1);
    $('[data-weight-chart]',host).innerHTML=rows.length<2?'':`<figure class="lift-chart"><figcaption>Last ${rows.length} weigh-ins · ${units}</figcaption><svg viewBox="0 0 300 140" role="img" aria-label="Body weight trend from ${rows[0].day} to ${rows.at(-1).day}. Values are listed in Weight history."><text x="4" y="16">${number(max)} ${units}</text><polyline points="${rows.map((e,i)=>`${x(e)},${y(values[i])}`).join(' ')}"/>${rows.map((e,i)=>`<circle cx="${x(e)}" cy="${y(values[i])}" r="3"><title>${e.day}: ${number(values[i])} ${units}</title></circle>`).join('')}<text x="4" y="120">${number(min)} ${units}</text><text x="4" y="137">${rows[0].day}</text><text x="220" y="137">${rows.at(-1).day}</text></svg></figure>`;
    $('[data-weight-history]',host).innerHTML=entries.length?[...entries].reverse().map(e=>`<div class="lift-weight-row"><span>${e.day}<br><strong>${number(weightIn(e.weight,e.units,units))} ${units}</strong></span><button class="btn btn-sm btn-line" data-edit-weight="${e.day}" aria-label="Edit weight for ${e.day}">Edit</button><button class="btn btn-sm btn-ghost" data-delete-weight="${e.day}" aria-label="Delete weight for ${e.day}">Delete</button></div>`).join(''):'<p class="small">No weigh-ins yet.</p>';
    $('[data-weight-export]',host).disabled=!entries.length;
  };
  date.onchange=selectDate;
  select.onchange=()=>{const next=select.value;if(input.value!==''&&Number.isFinite(input.valueAsNumber))input.value=String(Number(weightIn(input.valueAsNumber,units,next).toFixed(2)));units=next;paint();};
  $('[data-weight-form]',host).onsubmit=event=>{event.preventDefault();try {entries=writeWeight(localStorage,namespace,{day:date.value,weight:input.valueAsNumber,units},today);paint();selectDate();status.textContent='Weight saved on this device.';}catch(error){fail(error);}};
  $('[data-weight-history]',host).onclick=async event=>{
    const edit=event.target.closest('[data-edit-weight]'), remove=event.target.closest('[data-delete-weight]');
    if(edit){date.value=edit.dataset.editWeight;selectDate();input.focus();input.scrollIntoView({block:'center'});}
    if(remove&&await confirmSheet({title:'Delete this weigh-in?',body:`Remove the bodyweight entry for ${remove.dataset.deleteWeight}? Your workouts stay unchanged.`,ok:'Delete weight',danger:true}))try{entries=removeWeight(localStorage,namespace,remove.dataset.deleteWeight);paint();selectDate();status.textContent='Weigh-in deleted.';}catch(error){fail(error);}
  };
  $('[data-weight-export]',host).onclick=()=>{const url=URL.createObjectURL(new Blob([weightsCsv(entries)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='bodyweight.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  paint();selectDate();
}

export async function mountWeightSettings(host) {
  const privateKey=store.k;
  try {
    const namespace=await weightNamespace(privateKey);
    if(!host.isConnected||store.k!==privateKey)return;
    const paint=()=>{
      const settings=weightSettings(localStorage,namespace);
      host.innerHTML=`<div class="group"><div class="row"><span class="txt"><span class="t">Body weight with daily photos</span><span class="d">Optional · off by default · this device only</span></span><button class="toggle" role="switch" aria-label="Body weight with daily photos" aria-checked="${settings.enabled}" data-weight-enable></button></div></div><p class="small">When on, Photos shows an optional daily weigh-in. Blank weights never affect your challenge. Turning this off keeps saved weights.</p>`;
      $('[data-weight-enable]',host).onclick=()=>{try{saveWeightSettings(localStorage,namespace,{...settings,enabled:!settings.enabled});paint();}catch(error){$('[data-weight-setting-error]',host)?.remove();const message=document.createElement('p');message.dataset.weightSettingError='';message.setAttribute('role','alert');message.className='small';message.textContent='Could not save this setting. Please check browser storage.';host.append(message);}};
    };
    paint();
  } catch(error) {if(host.isConnected)host.textContent=error.message;}
}

export async function mountPhotoWeight(host) {
  const privateKey=store.k, today=store.me.today;
  try {
    const namespace=await weightNamespace(privateKey);
    if(!host.isConnected||store.k!==privateKey)return;
    const settings=weightSettings(localStorage,namespace);
    if(!settings.enabled){host.replaceChildren();return;}
    const entry=readWeights(localStorage,namespace).find(e=>e.day===today);
    let units=entry?.units??settings.units;
    host.innerHTML=`<section class="card card-pad photo-weight"><h2 class="h3">Today’s body weight <span class="small">· optional</span></h2><p class="small">${today} · only saved on this device</p><form data-photo-weight-form><div class="lift-fields"><label class="lift-field"><span>Body weight</span><input type="number" inputmode="decimal" name="weight" step="any" min="0.01" placeholder="Leave blank to skip" aria-label="Today's bodyweight"></label><label class="lift-field"><span>Unit</span><select name="units" aria-label="Body weight unit"><option value="lb">lb</option><option value="kg">kg</option></select></label></div><div class="lift-actions"><button class="btn btn-me" type="submit" data-save-photo-weight>${entry?'Update weight':'Save weight'}</button><button class="btn btn-line" type="button" data-weight-history-open>History</button></div><p class="small" role="status" data-photo-weight-status>${entry?'Weight saved. You can update it.':'Your photo counts with or without a weigh-in.'}</p></form></section>`;
    const input=$('[name=weight]',host), select=$('[name=units]',host), status=$('[data-photo-weight-status]',host);
    input.value=entry?String(Number(weightIn(entry.weight,entry.units,units).toFixed(2))):'';select.value=units;
    select.onchange=()=>{const next=select.value;if(input.value!==''&&Number.isFinite(input.valueAsNumber))input.value=String(Number(weightIn(input.valueAsNumber,units,next).toFixed(2)));units=next;};
    $('[data-photo-weight-form]',host).onsubmit=event=>{
      event.preventDefault();if(input.value===''){status.textContent='Skipped. Your photo and challenge are unchanged.';return;}
      try{writeWeight(localStorage,namespace,{day:today,weight:input.valueAsNumber,units},today);$('[data-save-photo-weight]',host).textContent='Update weight';status.textContent='Weight saved on this device.';}
      catch(error){status.textContent=error.message;}
    };
    $('[data-weight-history-open]',host).onclick=()=>openWeightTracker(()=>mountPhotoWeight(host)).catch(error=>{status.textContent=error.message;});
  } catch(error) {if(host.isConnected){host.textContent=error.message;host.setAttribute('role','status');}}
}
