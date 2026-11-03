import { store } from "../store.js";
import { icon } from "../icons.js";
import { $, $$, esc, haptic, toast, confirmSheet, fmtShort, isStandalone, isIOS } from "../util.js";
import { errorText, privateLink } from "../api.js";
import { MODES, changeMode, shortcutGuide } from "../photo.js";
import { pushState, enablePush, disablePush } from "../push.js";
import { REMINDERS, TOTAL } from "../rules.js";
import { applyTheme, getTheme } from "../theme.js";
import { openWidgetSetup } from "../widget-setup.js";

export function renderSettings(root) {
  const me = store.data.me;
  const ps = pushState();
  const theme = getTheme();
  const city = store.me.tz.split("/")[1].replace("_", " ");
  const rem = me.reminders ?? {};
  const s = store.stats(store.me);
  const pen = store.penalty;
  const partner = store.partner.name;

  const pushRow = {
    on: `<div class="row"><span class="row-ico">${icon("bell")}</span><span class="txt"><span class="t" style="display:block">Notifications</span><span class="d" style="display:block">On for this device</span></span></div>
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
      <div class="group">${pushRow}
        ${REMINDERS.map((r) => {
          const v = rem[r.key] ?? { at: r.at, on: true };
          return `<div class="row" data-rem="${r.key}">
            <span class="txt"><span class="t" style="display:block">${esc(r.label)}</span></span>
            <input class="time-input" type="time" value="${esc(v.at)}" data-rem-time aria-label="${esc(r.label)} time" ${v.on ? "" : "disabled"}>
            <button class="toggle" role="switch" aria-checked="${v.on}" aria-label="${esc(r.label)} reminder" data-rem-on></button>
          </div>`;
        }).join("")}
        <div class="row">
          <span class="txt"><span class="t" style="display:block">Nudges</span><span class="d" style="display:block">Let ${esc(partner)} nudge you</span></span>
          <button class="toggle" role="switch" aria-checked="${rem.nudges?.on !== false}" aria-label="Nudges" data-nudges-on></button>
        </div>
        <div class="row" data-note-row>
          <span class="txt"><span class="t" style="display:block">Daily note</span><span class="d" style="display:block">Today's line, at a random time most days</span></span>
          <button class="toggle" role="switch" aria-checked="${rem.note?.on !== false}" aria-label="Daily note" data-note-on></button>
        </div>
      </div>
      <p class="small" style="margin:10px 4px 0;color:var(--t3)">${esc(city)} time. These are yours only; ${esc(partner)} sets ${me.id === "sue" ? "his" : "her"} own.</p>
    </section>

    <section class="section">
      <span class="eyebrow">My diet</span>
      <textarea class="diet-input" rows="2" maxlength="160" placeholder="High protein, no fried food, no sweets" data-diet>${esc(store.me.diet ?? "")}</textarea>
      <div class="field-foot"><span>Shows under Diet on Today. "No alcohol" always stays.</span><span data-diet-count></span></div>
    </section>

    <section class="section">
      <span class="eyebrow">Challenge</span>
      <div class="group">
        <label class="row"><span class="row-ico">${icon("calendar")}</span><span class="txt"><span class="t" style="display:block">Start date</span><span class="d" style="display:block">For both of you</span></span>
          <input class="date-input" type="date" value="${esc(store.start)}" data-start></label>
        <div class="row"><span class="row-ico">${icon("flame")}</span><span class="txt"><span class="t" style="display:block">Your finish line</span><span class="d" style="display:block">${s.added ? `+${s.added} day${s.added > 1 ? "s" : ""} added so far` : "Nothing added so far"}</span></span>
          <span class="end" style="color:var(--t1);font-weight:600">${esc(fmtShort(s.finish))}</span></div>
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
        <li><b>No restarts.</b> ${pen === 2
          ? `Every unfinished past day adds 2 days to the end. You need ${TOTAL} completed days, plus one more for every miss.`
          : `Every unfinished past day adds 1 day to the end. You still need ${TOTAL} completed days.`}</li>
        <li><b>Missed check-ins</b> can be filled in later from Today. Tap any past day.</li>
      </ul></div>
      <div class="group" style="margin-top:10px">
        <div class="row"><span class="txt"><span class="t" style="display:block">Missed day adds:</span><span class="d" style="display:block">For both of you</span></span>
          <div class="seg-ctl two" role="group" aria-label="Missed day adds" style="width:164px;flex:none">
            ${[1, 2].map((n) => `<button aria-pressed="${pen === n}" data-penalty="${n}">${n} day${n > 1 ? "s" : ""}</button>`).join("")}
          </div></div>
      </div>
    </section>

    <section class="section">
      <span class="eyebrow">This device</span>
      <div class="group">
        ${!isStandalone() ? `<div class="row"><span class="row-ico">${icon("share")}</span><span class="txt"><span class="t" style="display:block">Add to Home Screen</span><span class="d" style="display:block">${isIOS() ? "In Safari: Share, then Add to Home Screen. Open it from there." : "Use your browser menu to install it."}</span></span></div>` : ""}
        <button class="row" data-widget><span class="row-ico">${icon("photos")}</span><span class="txt"><span class="t" style="display:block">Add home screen widget</span><span class="d" style="display:block">Day, progress and today's line</span></span><span class="end">${icon("chevR")}</span></button>
        <button class="row" data-copy><span class="row-ico">${icon("link")}</span><span class="txt"><span class="t" style="display:block">Copy my private link</span><span class="d" style="display:block">It's your key. Don't share it.</span></span><span class="end">${icon("chevR")}</span></button>
        <button class="row" data-replay><span class="row-ico">${icon("refresh")}</span><span class="txt"><span class="t" style="display:block">Replay the welcome</span></span><span class="end">${icon("chevR")}</span></button>
      </div>
    </section>
    <p class="foot-note">75 Hard · Sue v Carlos<br>¿Quién te Quiere?</p>
  </div>`;

  root.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-mode],[data-guide],[data-push-on],[data-push-off],[data-push-test],[data-theme-set],[data-copy],[data-replay],[data-penalty],[data-rem-on],[data-note-on],[data-nudges-on],[data-widget]");
    if (!t) return;
    if (t.dataset.penalty) {
      const v = Number(t.dataset.penalty);
      if (v === store.penalty) return;
      haptic();
      $$("[data-penalty]", root).forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
      try {
        store.setData(await store.api("penalty", { value: v })); // recomputes finish lines and the board
        toast(`A missed day now adds ${v} day${v > 1 ? "s" : ""}`, { ico: "check" });
      } catch (err) {
        toast(errorText(err), { error: true });
        store.emit("rerender");
      }
      return;
    }
    if (t.hasAttribute("data-widget")) { haptic(); return openWidgetSetup(); }
    if (t.hasAttribute("data-nudges-on")) {
      haptic();
      const on = t.getAttribute("aria-checked") !== "true";
      t.setAttribute("aria-checked", String(on));
      return saveReminder("nudges", { on });
    }
    if (t.hasAttribute("data-note-on")) {
      haptic();
      const on = t.getAttribute("aria-checked") !== "true";
      t.setAttribute("aria-checked", String(on));
      return saveReminder("note", { on });
    }
    if (t.hasAttribute("data-rem-on")) {
      haptic();
      const row = t.closest("[data-rem]");
      const on = t.getAttribute("aria-checked") !== "true";
      t.setAttribute("aria-checked", String(on));
      $("[data-rem-time]", row).disabled = !on;
      return saveReminder(row.dataset.rem, { on });
    }
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

  async function saveReminder(key, patch) {
    try {
      const d = await store.api("reminders", { reminders: { [key]: patch } });
      store.setData(d, { quiet: true });
      toast("Saved", { ico: "check", ms: 1400 });
    } catch (err) {
      toast(errorText(err), { error: true });
      store.emit("rerender");
    }
  }
  $$("[data-rem-time]", root).forEach((inp) => inp.addEventListener("change", () => {
    if (/^\d{2}:\d{2}$/.test(inp.value)) saveReminder(inp.closest("[data-rem]").dataset.rem, { at: inp.value.slice(0, 5) });
  }));

  // Diet rule: save when they stop typing or leave the field.
  const diet = $("[data-diet]", root);
  const count = $("[data-diet-count]", root);
  const showCount = () => (count.textContent = `${diet.value.length}/160`);
  showCount();
  let dietTimer = null, lastDiet = diet.value.trim();
  const saveDiet = async () => {
    clearTimeout(dietTimer);
    const v = diet.value.replace(/\s+/g, " ").trim();
    if (v === lastDiet) return;
    lastDiet = v;
    try {
      const d = await store.api("diet", { diet: v });
      store.setData(d, { quiet: true });
      toast("Diet saved", { ico: "check", ms: 1400 });
    } catch (err) { toast(errorText(err), { error: true }); }
  };
  diet.addEventListener("input", () => { showCount(); clearTimeout(dietTimer); dietTimer = setTimeout(saveDiet, 1200); });
  diet.addEventListener("blur", saveDiet);

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
