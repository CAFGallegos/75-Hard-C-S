import { store } from "../store.js";
import { icon } from "../icons.js";
import { $, esc, haptic, toast, isStandalone, isIOS, fmtShort } from "../util.js";
import { errorText } from "../api.js";
import { MODES, shortcutGuide } from "../photo.js";
import { pushState, enablePush } from "../push.js";
import { TASKS } from "../rules.js";

// Sue's welcome is Carlos talking to her. Copy as written.
const SUE_MODES = {
  phone: { t: "Keep them on your phone.", d: "Snap it here, save it to your Photos. Nothing gets uploaded." },
  album: { t: "Auto album.", d: "Same thing, but it drops them in a 75 Hard album for you. Takes a minute to set up. I'll walk you through it." },
  cloud: { t: "Keep them in the app.", d: "Private to you, and you can see day 1 next to today. Delete anything, anytime." },
};
const LOS_MODES = {
  phone: { t: MODES.phone.title, d: MODES.phone.desc },
  album: { t: MODES.album.title, d: MODES.album.desc },
  cloud: { t: MODES.cloud.title, d: MODES.cloud.desc },
};

const mark = `<div class="num w-hero" aria-label="S v C"><span class="s">S</span><span class="v">v</span><span class="c">C</span></div>`;

function screensFor(id) {
  const sue = id === "sue";
  const modes = sue ? SUE_MODES : LOS_MODES;
  const opts = (sel) => `<div class="choice" role="radiogroup" aria-label="Photo option">${Object.entries(modes).map(([k, m]) =>
    `<button class="opt" role="radio" aria-checked="${sel === k}" data-pick="${k}"><span class="oi">${icon(MODES[k].icon)}</span>
      <span><span class="ot" style="display:block">${esc(m.t)}</span><span class="od" style="display:block">${esc(m.d)}</span></span><span class="radio"></span></button>`).join("")}</div>`;

  const install = !isStandalone() && isIOS();
  const notif = (title, body) => `<div class="notif-art" aria-hidden="true"><div class="ic"><img src="icons/icon-192.png" alt=""></div>
      <div style="flex:1;min-width:0"><div class="tt">${title}<span>now</span></div><div class="bd">${body}</div></div></div>`;

  if (sue) {
    return [
      () => `${mark}
        <h1 class="w-title">Hey bb. Welcome to our 75&nbsp;Hard.</h1>
        <p class="w-p">75 days. Same rules for both of us. This is where we track it.</p>
        <p class="w-p">Every day: <b>two 45-min workouts (one outside)</b>, stick to <b>the diet</b>, <b>no drinks</b>, <b>a gallon of water</b>, <b>10 pages</b>, and <b>a progress pic</b>.</p>
        <div class="w-callout"><div class="h3">Miss a day?</div><p>No starting over. It just adds a day to the end.</p></div>
        <div class="w-callout"><div class="h3">Only got one workout in?</div><p>Still counts. It'll just make a note. We're busy, I get it.</p></div>`,
      (sel) => `<h1 class="w-title">Your progress pics are yours.</h1>
        <p class="w-p">The app never shows them to me. Pick how you want to do it:</p>
        ${opts(sel)}
        <p class="small" style="margin-top:14px;text-align:center">You can change this later in settings.</p>`,
      () => `<h1 class="w-title">Last thing.</h1>
        <p class="w-p">Turn on notifications so it can nudge you.</p>
        ${notif("Day 1. Workout 1.", "45 minutes. Get it in before the day gets loud.")}
        ${install ? `<div class="ios-steps">${icon("share")}<span>On iPhone, add it to your home screen first (<b style="color:var(--t1)">Share</b>, then <b style="color:var(--t1)">Add to Home Screen</b>), then open it from there.</span></div>`
          : `<p class="small" style="margin:0">On iPhone, add it to your home screen first (Share, then Add to Home Screen), then open it from there.</p>`}
        <p class="w-sign">Let's go bb.</p>`,
    ];
  }
  return [
    () => `${mark}
      <h1 class="w-title">Welcome, Los.</h1>
      <p class="w-p">75 days, same rules for both of you. Day 1 is ${esc(fmtShort(store.start))}.</p>
      <ul class="w-list">${TASKS.map((t) => `<li>${icon(t.icon)}<span>${t.title}${t.key === "w2" ? ", outside" : t.key === "water" ? ", 1 gal" : t.key === "read" ? ", 10 pages" : ""}</span></li>`).join("")}</ul>
      <div class="w-callout"><div class="h3">No restarts</div><p>Each unfinished day adds one to the end. You still need 75.</p></div>
      <div class="w-callout"><div class="h3">One workout</div><p>Still counts. It gets a "1 workout" note.</p></div>`,
    (sel) => `<h1 class="w-title">Progress photos.</h1>
      <p class="w-p">Sue never sees yours, and the app never shows you hers. Pick how you want to do it:</p>
      ${opts(sel)}
      <p class="small" style="margin-top:14px;text-align:center">You can change this later in settings.</p>`,
    () => `<h1 class="w-title">Reminders.</h1>
      <p class="w-p">6:45am workout, 3:30pm outdoor workout, 8:30pm check-in. The evening one skips itself if you're done. You'll also hear when Sue closes out her day.</p>
      ${notif("Sue closed out Day 12", "All six done for Day 12. Your move.")}
      ${install ? `<div class="ios-steps">${icon("share")}<span>On iPhone, add it to your Home Screen first (<b style="color:var(--t1)">Share</b>, then <b style="color:var(--t1)">Add to Home Screen</b>), then open it from there.</span></div>` : ""}`,
  ];
}

export function showWelcome({ onDone }) {
  const me = store.data.me;
  const screens = screensFor(me.id);
  let i = 0;
  let pick = me.onboarded ? (me.photo_mode === "checkbox" ? null : me.photo_mode) : null;
  let dir = "";

  const el = document.createElement("div");
  el.className = "welcome";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Welcome");
  document.body.appendChild(el);

  const render = () => {
    const last = i === screens.length - 1;
    const ps = pushState();
    el.innerHTML = `<div class="w-top">
        ${i > 0 ? `<button class="icon-btn" data-back aria-label="Back" style="background:transparent;margin-left:-10px">${icon("chevL")}</button>` : `<span style="width:44px"></span>`}
        <div class="w-dots" aria-hidden="true">${screens.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div>
        <span style="width:44px"></span>
      </div>
      <div class="w-body"><div class="w-screen ${dir}">${screens[i](pick)}</div></div>
      <div class="w-foot">${last
        ? `${ps.state === "on"
            ? `<div class="ok-line">${icon("check", "", 2.4)}Notifications on</div>`
            : `<button class="btn btn-block btn-me" data-push>${icon("bell")}Turn on notifications</button>`}
           <button class="btn btn-block ${ps.state === "on" ? "btn-me" : "btn-primary"}" data-go>Let's go</button>`
        : `<button class="btn btn-block btn-primary" data-next ${i === 1 && !pick ? "disabled" : ""}>Continue${icon("arrowR")}</button>`}
      </div>`;
  };
  render();

  el.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-next],[data-back],[data-pick],[data-push],[data-go]");
    if (!t) return;
    if (t.dataset.pick) {
      haptic();
      pick = t.dataset.pick;
      el.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-checked", String(b === t)));
      $("[data-next]", el).disabled = false;
      store.api("prefs", { photo_mode: pick }).then((d) => store.setData(d, { quiet: true })).catch(() => {});
      return;
    }
    if (t.hasAttribute("data-next")) { haptic(); i++; dir = ""; return render(); }
    if (t.hasAttribute("data-back")) { haptic(); i--; dir = "back"; return render(); }
    if (t.hasAttribute("data-push")) {
      haptic();
      const r = await enablePush();
      if (r.ok) { dir = "none"; render(); el.querySelector(".w-screen").style.animation = "none"; }
      return;
    }
    if (t.hasAttribute("data-go")) {
      haptic("success");
      t.disabled = true;
      try {
        const d = await store.api("prefs", { onboarded: true, photo_mode: pick ?? "phone" });
        store.setData(d, { quiet: true });
      } catch (err) {
        t.disabled = false;
        return toast(errorText(err), { error: true });
      }
      el.style.transition = "opacity .4s cubic-bezier(.2,.8,.2,1), transform .4s cubic-bezier(.2,.8,.2,1)";
      el.style.opacity = "0";
      el.style.transform = "scale(1.02)";
      setTimeout(() => {
        el.remove();
        onDone?.();
        if (pick === "album" && !store.data.me.tips?.shortcut_ready) setTimeout(() => shortcutGuide(), 350);
      }, 380);
    }
  });
}
