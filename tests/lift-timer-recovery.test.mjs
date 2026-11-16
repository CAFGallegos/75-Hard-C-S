import assert from 'node:assert/strict';
const memory=new Map(),intervals=[];let now=1000000,alerts=0;const nodes=[];
class Node {constructor(){this.dataset={};this.handlers={};this.children=[];this.classList={toggle(){},add(){},remove(){}};} setAttribute(){} addEventListener(k,fn){this.handlers[k]=fn;} appendChild(n){this.children.push(n);nodes.push(n);} querySelector(){return this.span??=(new Node());} remove(){} }
globalThis.document={visibilityState:'visible',body:new Node(),documentElement:{style:{setProperty(){}}},addEventListener(){},getElementById(){alerts++;return new Node();},createElement(){return new Node();}};
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
globalThis.window={innerHeight:844};globalThis.requestAnimationFrame=fn=>fn();
const originalInterval=globalThis.setInterval,originalTimeout=globalThis.setTimeout,originalNow=Date.now;
globalThis.setInterval=fn=>intervals.push(fn);globalThis.setTimeout=()=>0;Date.now=()=>now;
const {store}=await import('../js/store.js');store.k='timer-test';
try{
 let mod=await import('../js/lift-store.js?timer-test');await mod.initLift();mod.lift.draft={started_at:new Date(now).toISOString(),exercises:[],timer_end:null};mod.startRest(0);assert.equal(alerts,1,'zero rest alerts once');intervals.at(-1)();assert.equal(alerts,1);const end=mod.lift.draft.timer_end;assert.equal(mod.lift.draft.timer_alerted_end,end);
 mod=await import('../js/lift-store.js?timer-reloaded');await mod.initLift();assert.equal(mod.lift.draft.timer_alerted_end,end);assert.equal(alerts,1,'persisted expiry does not alert again after module reload');
 mod.startRest(120);const deadline=now+120000;assert.equal(mod.lift.draft.timer_end,deadline);now+=180000;document.visibilityState='hidden';intervals.at(-1)();assert.equal(alerts,1);document.visibilityState='visible';intervals.at(-1)();assert.equal(alerts,2,'background expiry alerts once when visible');intervals.at(-1)();assert.equal(alerts,2);
 assert.ok(mod.lift.draft.timer_alerted_end===deadline);
 // Sound APIs can throw even after a user gesture (for example, a closed audio context).
 window.AudioContext=class {state='running';createOscillator(){throw new Error('audio unavailable');}};
 const priorAlerts=alerts;now+=1000;mod.startRest(0);assert.equal(alerts,priorAlerts+1,'visible completion survives audio exceptions');
 mod.startRest(60);const timer=nodes.findLast(n=>n.className==='lift-timer');const click=timer.handlers.click;
 click({target:{closest:()=>({hasAttribute:()=>false,dataset:{restChange:'15'}})}});
 assert.equal(mod.lift.draft.timer_end,now+75000);
 click({target:{closest:()=>({hasAttribute:()=>false,dataset:{restChange:'-15'}})}});
 assert.equal(mod.lift.draft.timer_end,now+60000);
 mod=await import('../js/lift-store.js?timer-countdown-reloaded');await mod.initLift();
 assert.equal(mod.lift.draft.timer_end,now+60000,'unfinished countdown restores its deadline');
 const restored=nodes.findLast(n=>n.className==='lift-timer');assert.equal(restored.span.textContent,'Rest 1:00');
 restored.handlers.click({target:{closest:()=>({hasAttribute:()=>true})}});
 assert.equal(mod.lift.draft.timer_end,null,'dismissal persists');
 assert.equal(JSON.parse(memory.get(`${mod.lift.namespace}:draft`)).timer_end,null);
 console.log('ok  Actual timer zero-rest expiry, persisted alert marker, reload, background recovery, adjustments, dismissal, audio failure and duplicate-alert suppression');
}finally{globalThis.setInterval=originalInterval;globalThis.setTimeout=originalTimeout;Date.now=originalNow;}
