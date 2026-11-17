import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {server} from '../../tools/lift-preview.mjs';
const {chromium}=await import((process.env.LIFT_RELEASE_TOOLS??'/tmp/lift-release-tools')+'/node_modules/playwright/index.mjs');
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.LIFT_CHROMIUM??'/home/flogal_dev/.cache/ms-playwright/chromium-1252/chrome-linux64/chrome',args:['--no-sandbox']});
await mkdir('/tmp/photo-weight-preview',{recursive:true});
try{for(const width of [320,375,390])for(const theme of ['light','dark'])for(const key of ['sample-a','sample-b']){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true});await context.addInitScript(t=>localStorage.setItem('theme75',t),theme);const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],external=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const r=route.request();if(!r.url().startsWith(base+'/')){external.push(r.url());return route.abort();}if(r.url().endsWith('/__preview_api')){const a=r.postDataJSON()?.a;if(!['state','lift_state','photos','lift_history'].includes(a))writes.push(a);}return route.continue();});
 await page.goto(base+`/?k=${key}`);await page.locator('[data-tab=photos]').click();assert.equal(await page.locator('[data-photo-weight-form]').count(),0);
 await page.locator('[data-tab=settings]').click();await page.locator('[data-weight-enable]').waitFor();assert.equal(await page.locator('[data-weight-enable]').getAttribute('aria-checked'),'false');await page.locator('[data-weight-enable]').click();
 await page.locator('[data-tab=photos]').click();const form=page.locator('[data-photo-weight-form]');await form.waitFor();
 const challenge=await page.evaluate(async()=>JSON.stringify((await import('/js/store.js')).store.data.people));
 await page.locator('[data-save-photo-weight]').click();assert.match(await page.locator('[data-photo-weight-status]').innerText(),/Skipped/);
 await form.locator('[name=units]').selectOption('kg');await form.locator('[name=weight]').fill('65.5');await page.locator('[data-save-photo-weight]').click();assert.match(await page.locator('[data-photo-weight-status]').innerText(),/saved/);
 await page.reload();await page.locator('[data-tab=photos]').click();await form.waitFor();assert.equal(await form.locator('[name=weight]').inputValue(),'65.5');assert.equal(await form.locator('[name=units]').inputValue(),'kg');
 assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/store.js')).store.data.people)),challenge,'weight never changes challenge');
 await page.locator('[data-weight-history-open]').click();const historyForm=page.locator('[data-weight-form]');await historyForm.waitFor();const today=await historyForm.locator('[name=day]').inputValue();const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 await historyForm.locator('[name=day]').fill(yesterday);await historyForm.locator('[name=units]').selectOption('kg');await historyForm.locator('[name=weight]').fill('66');await page.locator('[data-save-weight]').click();assert.equal(await page.locator('[data-weight-chart] svg').count(),1);
 await page.locator('.lift-weight-history > summary').click();assert.equal(await page.locator('[data-edit-weight]').count(),2);await page.locator(`[data-edit-weight="${yesterday}"]`).click();await historyForm.locator('[name=weight]').fill('66.2');await page.locator('[data-save-weight]').click();assert.equal(await page.locator('[data-edit-weight]').count(),2);
 const download=page.waitForEvent('download');await page.locator('[data-weight-export]').click();const csv=await readFile(await(await download).path(),'utf8');assert.match(csv,/66.2,kg/);assert.match(csv,/65.5,kg/);
 await page.locator(`[data-delete-weight="${yesterday}"]`).click();await page.locator('[data-ok]').click();await page.waitForTimeout(350);assert.equal(await page.locator('[data-edit-weight]').count(),1);await page.locator('[data-weight-close]').click();await page.waitForTimeout(350);
 assert.equal(await form.locator('[name=weight]').inputValue(),'65.5');
 // All existing photo modes retain the optional field, without calling upload/delete APIs.
 for(const mode of ['cloud','phone','album','checkbox']){await page.evaluate(async mode=>{const {store}=await import('/js/store.js');store.data.me.photo_mode=mode;store.emit('nav:photos');},mode);await page.locator('[data-photo-weight-form]').waitFor();assert.equal(await page.locator('[data-photo-weight-form] [name=weight]').inputValue(),'65.5');}
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);await page.screenshot({path:`/tmp/photo-weight-preview/${key}-${width}-${theme}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[data-tab=settings]').click();await page.locator('[data-weight-enable]').click();assert.equal(await page.locator('[data-weight-enable]').getAttribute('aria-checked'),'false');await page.locator('[data-tab=photos]').click();assert.equal(await page.locator('[data-photo-weight-form]').count(),0);
 await page.locator('[data-tab=settings]').click();await page.locator('[data-weight-enable]').click();await page.locator('[data-tab=photos]').click();await form.waitFor();assert.equal(await form.locator('[name=weight]').inputValue(),'65.5','disable retains entries');
 const other=key==='sample-a'?'sample-b':'sample-a';await page.goto(base+`/?k=${other}`);await page.locator('[data-tab=settings]').click();await page.locator('[data-weight-enable]').waitFor();assert.equal(await page.locator('[data-weight-enable]').getAttribute('aria-checked'),'false','other private link stays off');await page.locator('[data-weight-enable]').click();await page.locator('[data-tab=photos]').click();await form.waitFor();assert.equal(await form.locator('[name=weight]').inputValue(),'','no shared weights');
 await page.locator('[data-tab=lift]').click();assert.equal(await page.locator('[data-weight-open]').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[],'weight/photo settings do not call backend writes');await context.close();console.log(`PASS photos weight ${key} ${width} ${theme}: opt-in, skip, save/reload, history/CSV/delete, photo modes, isolation`);
}}finally{await browser.close();await new Promise(r=>server.close(r));}
