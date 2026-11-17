// Actual Chromium, synthetic profiles, no production requests or service worker.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../../tools/lift-preview.mjs';
import {seedVisualPreview} from '../../tools/lift-polish-preview.mjs';
const {chromium}=await import((process.env.LIFT_RELEASE_TOOLS??'/tmp/lift-release-tools')+'/node_modules/playwright/index.mjs');
await seedVisualPreview();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;const output='/tmp/lift-polish-after';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LIFT_CHROMIUM??'/home/flogal_dev/.cache/ms-playwright/chromium-1252/chrome-linux64/chrome',args:['--no-sandbox']});
const draft=page=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/js/lift-store.js')).lift.draft)));
const tile=(page,index)=>page.locator(`.lift-photo-rail [data-focus-index="${index}"]`);
const open=async(page,selector)=>{const loc=page.locator(selector);if(!await loc.evaluate(el=>el.open))await loc.locator(':scope > summary').click();};
const close=async(page,selector)=>{const loc=page.locator(selector);if(await loc.evaluate(el=>el.open))await loc.locator(':scope > summary').click();};
const checkRail=async page=>assert.equal(await page.locator('.lift-photo-tab.is-current').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;}),true,'selected tile visible');
try {for(const width of (process.env.LIFT_VISUAL_WIDTHS??'320,375,390').split(',').map(Number))for(const theme of ['light','dark'])for(const key of ['sample-a','sample-b']) {
 const name=key==='sample-a'?'carlos':'sue';const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(t=>localStorage.setItem('theme75',t),theme);
 const external=[];await context.route('**/*',route=>{if(route.request().url().startsWith(base+'/'))return route.continue();external.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+`/?k=${key}&tab=lift`);await page.locator('[data-start]').first().click();
 await page.waitForFunction(()=>document.querySelector('.lift-active-photos')?.getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('.lift-active-exercise').count(),1);assert.equal(await page.locator('[data-complete][aria-pressed=true]').count(),0);
 const initial=await draft(page);assert.equal(initial.exercises[0].logged[0].weight,key==='sample-a'?20:null);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);await page.screenshot({path:`${output}/${name}-${width}-${theme}.png`});
 if(key==='sample-a'){assert.match(await page.locator('[data-illustration-caption]').innerText(),/approximation.*Medium grip/);assert.equal(await page.locator('.lift-active-photos img').count(),2);await page.waitForFunction(()=>[...document.querySelectorAll('.lift-active-photos img')].every(img=>img.complete&&img.naturalWidth>0));assert.equal(await page.locator('.lift-active-photos img').first().evaluate(img=>getComputedStyle(img).objectFit),'contain');assert.equal(await page.locator('.lift-rir-plus').first().innerText(),'+');}
 await open(page,'.lift-exercise-more');await page.locator('[data-notes="0"]').fill('Sample note retained');
 for(const attr of ['edit-active','swap-active','active-move','remove-active','reference'])assert.ok(await page.locator(`[data-${attr}]`).first().isVisible(),attr+' reachable');
 await close(page,'.lift-exercise-more');
 await page.locator('[data-value="0:0:weight"]').fill('22.5');await page.locator('[data-value="0:0:rir"]').fill('1.5');await page.locator('[data-complete="0:0"]').click();await page.locator('.lift-timer').waitFor();
 const end=(await draft(page)).timer_end;await tile(page,initial.exercises.length-1).click();await checkRail(page);assert.equal((await draft(page)).timer_end,end);
 await tile(page,0).click();assert.equal(await page.locator('[data-value="0:0:weight"]').inputValue(),'22.5');
 await page.reload();await page.locator('[data-tab=lift]').click();await page.locator('[data-complete="0:0"][aria-pressed=true]').waitFor();
 assert.equal((await draft(page)).timer_end,end);assert.equal((await draft(page)).exercises[0].notes,'Sample note retained');
 await open(page,'.lift-set-options');await page.locator('[data-qualifier="0:0"]').click();assert.equal(await page.locator('.lift-set-options').getAttribute('open'),'','options stay open after editing');
 assert.equal((await draft(page)).exercises[0].logged[0].details.rir_qualifier,key==='sample-a'?'exact':'at_least');
 await close(page,'.lift-set-options');
 for(let si=1;si<initial.exercises[0].logged.length;si++){await page.locator(`[data-value="0:${si}:weight"]`).fill('25');await page.locator(`[data-complete="0:${si}"]`).scrollIntoViewIfNeeded();await page.locator(`[data-complete="0:${si}"]`).click();}
 assert.equal(await tile(page,0).locator('.lift-photo-number').innerText(),'✓');assert.equal(await tile(page,1).getAttribute('aria-current'),'step');await checkRail(page);
 await page.locator('[data-focus-overview]').click();await page.locator('[data-jump="0"]').click();assert.equal(await tile(page,0).getAttribute('aria-current'),'step');
 await open(page,'[data-panel=controls]');for(const attr of ['discard','pause','update-permanent','generator-open','programs-open','backup-open'])assert.ok(await page.locator(`[data-${attr}]`).isVisible(),attr+' reachable');
 await page.locator('[data-pause]').click();assert.ok((await draft(page)).paused_at);await page.locator('[data-pause]').click();assert.equal((await draft(page)).paused_at,null);await close(page,'[data-panel=controls]');
 // Browser input focus / reduced viewport, not a physical iOS keyboard claim.
 await page.setViewportSize({width,height:500});await page.locator('[data-value="0:0:reps"]').focus();await page.locator('[data-value="0:0:reps"]').press('Tab');assert.equal(await page.locator('[data-value="0:0:rir"]').evaluate(el=>el===document.activeElement),true);
 await page.setViewportSize({width,height:844});await page.locator('[data-finish]').scrollIntoViewIfNeeded();
 const finish=await page.locator('[data-finish]').boundingBox(),timer=await page.locator('.lift-timer').boundingBox(),nav=await page.locator('.tabbar').boundingBox();assert.ok(finish.y+finish.height<=timer.y,'finish above timer');assert.ok(timer.y+timer.height<=nav.y,'timer above bottom navigation');
 if(width===390&&theme==='dark') {
  await tile(page,key==='sample-a'?3:0).click();
  if(key==='sample-a')assert.match(await page.locator('.lift-active-photos').innerText(),/No photo available/);
  const at=key==='sample-a'?3:0;const prior=await draft(page);
  await page.locator(`[data-choose-illustration="${at}"]`).click();await page.locator('[data-illustration-search]').fill('side lateral raise');await page.locator('[data-illustration-id="Side_Lateral_Raise"]').click();
  assert.deepEqual((await draft(page)).exercises,prior.exercises,'photo choice cannot mutate exercises');assert.equal((await draft(page)).timer_end,prior.timer_end);
  await page.reload();await page.locator('[data-tab=lift]').click();await page.locator('[data-illustration-caption]').filter({hasText:'Chosen illustration'}).waitFor();
  await context.route('**/icons/exercises/*.jpg',r=>r.abort());await page.reload();await page.locator('[data-tab=lift]').click();await page.locator('.lift-active-photos .no-photo').first().waitFor();assert.match(await page.locator('.lift-active-photos').innerText(),/Photo unavailable/);
  await context.setOffline(true);await tile(page,1).click();await tile(page,at).click();assert.equal((await draft(page)).exercises[at].name,prior.exercises[at].name);await context.setOffline(false);
  await context.unroute('**/icons/exercises/*.jpg');await page.locator(`[data-choose-illustration="${at}"]`).click();await page.locator('[data-reset-illustration]').click();assert.equal((await draft(page)).illustrations[prior.exercises[at].runtime_id],undefined);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`${output}/${name}-${width}-${theme}-interaction.png`,fullPage:true});await context.close();console.log(`PASS ${name} ${width} ${theme}: photo rail, entries, qualifiers, navigation, timer, reload, controls, overlap`);
}} finally {await browser.close();await new Promise(r=>server.close(r));}
