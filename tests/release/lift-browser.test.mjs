// Uses isolated mock API only; requires temporary Playwright driver and a browser executable.
const {chromium}=await import((process.env.LIFT_RELEASE_TOOLS??'/tmp/lift-release-tools')+'/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {startingRoutine} from '../../js/lift-routine.js';
import {server,mockCall} from '../../tools/lift-preview.mjs';
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const state=mockCall({k:'sample-a',a:'lift_state'});const seeded=startingRoutine({...state.plan,days:state.days});seeded.days=seeded.days.slice(0,1);seeded.days[0].exercises=seeded.days[0].exercises.slice(0,2);mockCall({k:'sample-a',a:'lift_plan_save',plan:seeded});
const browser=await chromium.launch({executablePath:process.env.LIFT_CHROMIUM??'/home/flogal_dev/.cache/ms-playwright/chromium-1252/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try{for(const width of [320,375,390])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844}});await context.addInitScript(t=>localStorage.setItem('theme75',t),theme);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?k=sample-a&tab=lift');
 await page.locator('[data-start]').first().click();assert.equal(await page.locator('[data-set-row]').count(),4);await page.locator('[data-notes="0"]').fill('Navigation recovery note');await page.locator('[data-focus-index="1"]').click();assert.equal(await page.locator('[data-set-row]').count(),3);await page.locator('[data-focus-index="0"]').click();assert.equal(await page.locator('[data-notes="0"]').inputValue(),'Navigation recovery note');await page.locator('[data-value="0:0:weight"]').fill('125');await page.locator('[data-complete="0:0"]').click();await assert.doesNotReject(()=>page.locator('.lift-timer').waitFor());
 await page.reload();await page.locator('[data-tab=lift]').click();await page.locator('[data-value="0:0:weight"]').waitFor();assert.equal(await page.locator('[data-value="0:0:weight"]').inputValue(),'125');assert.equal(await page.locator('[data-complete="0:0"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');assert.deepEqual(errors,[]);
 await page.waitForTimeout(700);await page.screenshot({path:`/tmp/lift-release-${width}-${theme}.png`,fullPage:true});await page.locator('[data-pause]').click();assert.match(await page.locator('[data-pause]').innerText(),/Resume/);await page.locator('[data-pause]').click();
 await context.setOffline(true);await page.locator('[data-finish]').click();await page.locator('[data-ok]').click();await page.locator('[data-finish]').filter({hasText:'Retry Finish'}).waitFor();await context.setOffline(false);await page.locator('[data-finish]').click();await page.locator('[data-ok]').waitFor();assert.match(await page.locator('.sheet').innerText(),/Workout saved/);await page.locator('[data-ok]').click();await page.locator('[data-close]').click();
 await page.locator('[data-library-open]').click();await page.locator('[data-search]').fill('bench');await page.locator('[data-info]').first().waitFor();await page.locator('[data-info]').first().locator('summary').click();await page.locator('[data-close-library]').click();
 await page.locator('[data-screen="progress"]').click();await page.locator('[data-analytics]').waitFor();assert.deepEqual(errors,[]);
 await context.close();console.log('PASS mobile',width,theme,'log/reload/timer/no overflow');
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
