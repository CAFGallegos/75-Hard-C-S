import { store } from "../store.js";
import { icon } from "../icons.js";
import { $, $$, esc, haptic, toast, confirmSheet, fmtShort, isStandalone, isIOS } from "../util.js";
import { errorText, privateLink } from "../api.js";
import { MODES, changeMode, shortcutGuide } from "../photo.js";
import { pushState, enablePush, disablePush } from "../push.js";
import { addDays, TOTAL } from "../rules.js";
import { applyTheme, getTheme } from "../theme.js";

export function renderSettings(root) {
  const me = store.data.me;
  const ps = pushState();
  const theme = getTheme();
  const city = store.me.tz.split("/")[1].replace("_", " ");

  const pushRow = {
    on: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications</span><span class="d" style="display:block">On · 6:45am, 3:30pm, 8:30pm ${esc(city)} time</span></span></div>
         <div class="row" style="gap:10px"><button class="btn btn-sm btn-ghost" data-push-test style="flex:1">Send a test</button><button class="btn btn-sm btn-line" data-push-off style="flex:1">Turn off</button></div>`,
    off: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications</span><span class="d" style="display:block">Off on this device</span></span>
         <button class="btn btn-sm btn-me" data-push-on>Turn on</button></div>`,
    denied: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications are blocked</span><span class="d" style="display:block">Turn them on in iPhone Settings › Notifications › 75 Hard.</span></span></div>`,
    install: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications need the app</span><span class="d" style="display:block">Tap Share, then Add to Home Screen. Open it from there and turn them on.</span></span></div>`,
    unsupported: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications</span><span class="d" style="display:block">Not supported in this browser.</span></span></div>`,
  }[ps.state];

  root.innerHTML = `<div class="view">
    <div class="topbar"><span class="mark"><span class="s">S</span><span class="v">v</span><span class="c">C</span></span></div>
    <header class="page-head"><span class="eyebrow">Settings</span><h1 class="h1">You</h1></header>

    <section class="card profile">
      <span class="avatar ${me.id}">${esc(me.name[0])}</span>
      <div><div class="h2">${esc(me.name)}</div><div class="small">${esc(city)} time · ${me.id === "sue" ? "Pink" : "Brown"}</div></div>
    </section>

    <section class="section">
      <span class="eyebrow">Progress photos</span>
      <div class="choice" role="radiogroup" aria-label="Photo mode">
        ${Object.entries(MODES).map(([k, m]) => `<button class="opt compact" role="radio" aria-checked="${me.photo_mode === k}" data-mode="${k}">
          <span class="oi">${icon(m.icon)}</span><span><span class="ot" style="display:block">${esc(m.title)}</span><span class="od" style="display:block">${esc(m.desc)}</span></span><span class="radio"></span></button>`).join("")}
      </div>
      ${me.photo_mode === "album" ? `<button class="btn btn-ghost btn-block" style="margin-top:10px" data-guide>${icon("bolt")}Shortcut setup guide</button>` : ""}
      <div class="privacy" style="margin-top:10px">${icon("lock")}<span>Only you can see your photos. ${esc(store.partner.name)} only sees that it's done.</span></div>
    </section>

    <section class="section">
      <span class="eyebrow">Reminders</span>
      <div class="group">${pushRow}</div>
    </section>

    <section class="section">
      <span class="eyebrow">Challenge</span>
      <div class="group">
        <label class="row"><span class="row-ico">${icon("calendar")}</span><span class="txt"><span class="t" style="display:block">Start date</span><span class="d" style="display:block">For both of you</span></span>
          <input class="date-input" type="date" value="${esc(store.start)}" data-start></label>
        <div class="row"><span class="row-ico">${icon("flame")}</span><span class="txt"><span class="t" style="display:block">Clean finish</span><span class="d" style="display:block">If nobody misses a day</span></span>
          <span class="end">${esc(fmtShort(addDays(store.start, TOTAL - 1)))}</span></div>
      </div>
    </section>

    <section class="section">
      <span class="eyebrow">Appearance</span>
      <div class="seg-ctl" role="group" aria-label="Theme">
        ${["dark", "light", "system"].map((t) => `<button aria-pressed="${theme === t}" data-theme-set="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      </div>
    </section>

    <section class="section">
      <span class="eyebrow">Our rules</span>
      <div class="group"><ul class="rules">
        <li><b>Every day:</b> two 45-min workouts (one outdoors), the diet with no cheat meals and no alcohol, a gallon of water, 10 pages of non-fiction, and a progress pic.</li>
        <li><b>Complete</b> means everything's done.</li>
        <li><b>Only one workout?</b> Still counts. It gets a small "1 workout" note.</li>
        <li><b>No restarts.</b> Every unfinished past day adds 1 day to the end. You still need 75 completed days.</li>
        <li><b>Missed check-ins</b> can be filled in later from Today. Tap any past day.</li>
      </ul></div>
    </section>

    <section class="section">
      <span class="eyebrow">This device</span>
      <div class="group">
        ${!isStandalone() ? `<div class="row"><span class="row-ico">${icon("share")}</span><span class="txt"><span class="t" style="display:block">Add to Home Screen</span><span class="d" style="display:block">${isIOS() ? "In Safari: Share, then Add to Home Screen. Open it from there." : "Use your browser menu to install it."}</span></span></div>` : ""}
        <button class="row" data-copy><span class="row-ico">${icon("link")}</span><span class="txt"><span class="t" style="display:block">Copy my private link</span><span class="d" style="display:block">It's your key. Don't share it.</span></span><span class="end">${icon("chevR")}</span></button>
        <button class="row" data-replay><span class="row-ico">${icon("refresh")}</span><span class="txt"><span class="t" style="display:block">Replay the welcome</span></span><span class="end">${icon("chevR")}</span></button>
      </div>
    </section>
    <p class="foot-note">75 Hard · Sue v Carlos<br>Made for two.</p>
  </div>`;

  root.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-mode],[data-guide],[data-push-on],[data-push-off],[data-push-test],[data-theme-set],[data-copy],[data-replay]");
    if (!t) return;
    if (t.dataset.mode) {
      const mode = t.dataset.mode;
      if (mode === store.data.me.photo_mode) return;
      haptic();
      $$("[data-mode]", root).forEach((b) => b.setAttribute("aria-checked", String(b === t)));
      try {
        await changeMode(mode);
        toast(`Photos: ${MODES[mode].title}`, { ico: "check" });
        if (mode === "album" && !store.data.me.tips?.shortcut_ready) shortcutGuide();
      } catch (err) {
        toast(errorText(err), { error: true });
        renderSettings(root);
      }
      return;
    }
    if (t.hasAttribute("data-guide")) return shortcutGuide();
    if (t.hasAttribute("data-push-on")) { haptic(); const r = await enablePush(); if (r.ok) store.emit("rerender"); return; }
    if (t.hasAttribute("data-push-off")) { haptic(); await disablePush(); return store.emit("rerender"); }
    if (t.hasAttribute("data-push-test")) {
      haptic();
      try {
        const r = await store.api("push_test");
        toast(r.sent ? "Sent. Check your lock screen." : "No device answered. Try turning it off and on.", { error: !r.sent, ico: "bell" });
      } catch (err) { toast(errorText(err), { error: true }); }
      return;
    }
    if (t.dataset.themeSet) {
      haptic();
      applyTheme(t.dataset.themeSet);
      $$("[data-theme-set]", root).forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
      return;
    }
    if (t.hasAttribute("data-copy")) {
      try { await navigator.clipboard.writeText(privateLink(store.k)); haptic(); toast("Link copied", { ico: "check" }); }
      catch (_) { toast("Couldn't copy on this device.", { error: true }); }
      return;
    }
    if (t.hasAttribute("data-replay")) { haptic(); return store.emit("welcome"); }
  });

  $("[data-start]", root).addEventListener("change", async (ev) => {
    const v = ev.target.value;
    if (!v || v === store.start) return;
    const ok = await confirmSheet({
      title: "Change the start date?",
      body: `Day 1 becomes ${fmtShort(v)} for both of you. Check-ins before that date stop counting.`,
      ok: "Change it",
    });
    if (!ok) { ev.target.value = store.start; return; }
    try {
      const d = await store.api("start_date", { start_date: v });
      store.setData(d);
      toast(`Day 1 is ${fmtShort(v)}`, { ico: "calendar" });
    } catch (err) {
      ev.target.value = store.start;
      toast(errorText(err), { error: true });
    }
  });
}
