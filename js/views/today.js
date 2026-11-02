import { store } from "../store.js";
import { TASKS, TOTAL, WATER_GOAL, OZ_PER_BOTTLE, blank, taskDone, doneCount, isComplete, isOneWorkout, dayNum, diffDays, waterPace, addDays } from "../rules.js";
import { icon, bottleSvg } from "../icons.js";
import { $, $$, esc, fmtLong, fmtMD, fmtWd, fmtWdShort, fmtShort, pad2, haptic } from "../util.js";
import { startPhoto, photoMeta } from "../photo.js";
import { pushState, enablePush } from "../push.js";

const SEG_GAP = 9; // degrees between ring segments

function ringSvg() {
  const r = 56, c = 66;
  const segs = TASKS.map((t, i) => {
    const a0 = (i * 60 + SEG_GAP / 2) * (Math.PI / 180);
    const a1 = ((i + 1) * 60 - SEG_GAP / 2) * (Math.PI / 180);
    const p = (a) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
    return `<path class="seg" data-seg="${t.key}" d="M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}"/>`;
  }).join("");
  return `<svg viewBox="0 0 132 132"><circle class="glow" cx="66" cy="66" r="56"/>${segs}</svg>`;
}

function taskRow(t) {
  if (t.key === "water") {
    const bottles = Array.from({ length: WATER_GOAL }, (_, i) =>
      `<button class="bottle" data-bottle="${i}" aria-label="Bottle ${i + 1}">${bottleSvg(i)}</button>`).join("");
    return `<div class="task task-water" data-task="water">
      <div class="wrow">
        <div class="task-ico">${icon(t.icon)}</div>
        <div class="task-txt"><div class="task-title">${t.title}</div><div class="task-meta" data-meta></div></div>
        <div class="check" aria-hidden="true">${icon("check")}</div>
      </div>
      <div class="bottles">${bottles}</div>
      <div class="water-foot"><span>8 bottles × 16 oz</span><span data-pace></span></div>
    </div>`;
  }
  return `<button class="task" data-task="${t.key}" aria-pressed="false">
    <div class="task-ico">${icon(t.icon)}</div>
    <div class="task-txt"><div class="task-title">${t.title}</div><div class="task-meta" data-meta></div></div>
    <div class="check" aria-hidden="true">${icon("check")}</div>
  </button>`;
}

const metaHtml = (parts) => parts.map((p, i) => (i ? '<i class="sep"></i>' : "") + `<span>${esc(p)}</span>`).join("");

function preStart(root) {
  const me = store.me;
  const days = diffDays(me.today, store.start);
  const finish = addDays(store.start, TOTAL - 1);
  const ps = pushState();
  root.innerHTML = `<div class="view">
    <div class="topbar"><span class="mark"><span class="s">S</span><span class="v">v</span><span class="c">C</span></span>
      <span class="pill">${icon("calendar")}${esc(fmtShort(store.start))}</span></div>
    <section class="card countdown">
      <div class="eyebrow">Day 1 starts</div>
      ${days === 1
        ? `<div class="h-display" style="margin-top:18px">Tomorrow</div>`
        : `<div style="display:flex;align-items:flex-end;margin-top:18px"><span class="num big">${days}</span><span class="num unit">days</span></div>`}
      <p class="body" style="margin-top:14px">${esc(fmtLong(store.start))}. Finish line is ${esc(fmtShort(finish))} if nobody misses a day.</p>
      <div class="bg-v" aria-hidden="true">75</div>
    </section>
    <section class="section">
      <span class="eyebrow">Every day, both of you</span>
      <div class="card card-pad preview-list" style="padding-top:6px;padding-bottom:6px">
        ${TASKS.map((t) => `<div class="preview-item"><div class="task-ico">${icon(t.icon)}</div>
          <div><div class="h3" style="font-size:15.5px">${t.title}</div><div class="small">${t.meta.join(" · ")}</div></div></div>`).join("")}
      </div>
    </section>
    ${ps.state !== "on" ? `<section class="section">
      <div class="card card-pad">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <div class="task-ico" style="background:color-mix(in srgb,var(--me) 16%,transparent);color:var(--me-ink)">${icon("bell")}</div>
          <div style="flex:1"><div class="h3">Get the nudges</div>
          <p class="small" style="margin:4px 0 0">6:45am workout, 3:30pm outdoor workout, 8:30pm check-in.</p></div>
        </div>
        <div style="margin-top:16px">${ps.state === "install"
          ? `<div class="tip" style="margin-top:0">${icon("share")}<span>Add this to your Home Screen first: <b>Share</b>, then <b>Add to Home Screen</b>. Open it from there.</span></div>`
          : ps.state === "denied"
            ? `<div class="tip" style="margin-top:0">${icon("info")}<span>Notifications are blocked. Turn them on in <b>Settings › Notifications › 75 Hard</b>.</span></div>`
            : `<button class="btn btn-me btn-block" data-push>${icon("bell")}Turn on notifications</button>`}</div>
      </div></section>` : ""}
    <p class="foot-note">No restarts. Miss a day and it adds one to the end.</p>
  </div>`;
  $("[data-push]", root)?.addEventListener("click", async () => {
    haptic();
    const r = await enablePush();
    if (r.ok) preStart(root);
  });
}

export function renderToday(root) {
  const me = store.me;
  const s = store.stats(me);
  if (!s.started) return preStart(root);

  const sel = store.selDay && store.selDay <= me.today && store.selDay >= store.start ? store.selDay : me.today;
  store.selDay = sel === me.today ? null : sel;
  const isToday = sel === me.today;

  root.innerHTML = `<div class="view">
    <div class="topbar">
      <span class="mark"><span class="s">S</span><span class="v">v</span><span class="c">C</span></span>
      <span class="pill" data-streak>${icon("flame")}<span></span></span>
    </div>
    <section class="hero">
      <div class="hero-day">
        <div class="eyebrow" data-date>${esc(isToday ? "Today · " : "")}${esc(fmtShort(sel))}</div>
        <div class="hero-num"><span class="num big">${pad2(dayNum(store.start, sel))}</span><span class="num of">/${TOTAL}</span></div>
        <div class="hero-sub" data-heropills></div>
      </div>
      <div class="ring" data-ring>${ringSvg()}
        <div class="ring-center"><div><div class="num n" data-ringn></div><div class="eyebrow l">Done</div></div></div>
        <div class="ring-check">${icon("check", "", 2.6)}</div>
      </div>
    </section>
    ${isToday ? `<button class="partner-chip" data-go="board"></button>` : ""}
    <div class="strip-wrap"><div class="strip" data-strip role="tablist" aria-label="Days"></div></div>
    ${!isToday ? `<div class="past-banner"><div class="txt">Editing <b>${esc(fmtLong(sel))}</b>. Filling it in still counts.</div>
      <button class="btn btn-sm btn-primary" data-today>Today</button></div>` : ""}
    <div class="tasks">${TASKS.map(taskRow).join("")}</div>
    <section class="section">
      <span class="eyebrow">Your 75</span>
      <div class="stats" data-stats></div>
    </section>
  </div>`;

  // Strip
  const strip = $("[data-strip]", root);
  strip.innerHTML = s.days.map((d) => `<button class="chip-day" data-day="${d.day}" role="tab">
      <span class="wd">${esc(fmtWd(d.day))}</span><span class="num dn">${dayNum(store.start, d.day)}</span><span class="st"></span></button>`).join("");
  requestAnimationFrame(() => {
    const c = $(`[data-day="${sel}"]`, strip);
    if (c) strip.scrollLeft = c.offsetLeft - strip.clientWidth / 2 + c.clientWidth / 2;
  });

  wire(root, sel);
  paint(root, sel);
}

function wire(root, sel) {
  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-task],[data-bottle],[data-day],[data-today],[data-go]");
    if (!t || !root.contains(t)) return;

    if (t.dataset.go) return store.emit("nav:" + t.dataset.go);
    if (t.hasAttribute("data-today")) { haptic(); store.selDay = null; return store.emit("rerender"); }
    if (t.dataset.day) {
      haptic();
      store.selDay = t.dataset.day === store.me.today ? null : t.dataset.day;
      return store.emit("rerender");
    }
    if (t.dataset.bottle != null) {
      const i = Number(t.dataset.bottle);
      const cur = (store.entry(sel) ?? blank(sel)).water;
      const next = cur === i + 1 ? i : i + 1;
      haptic(next === WATER_GOAL ? "success" : "light");
      t.classList.remove("fill-anim");
      if (next > cur) { void t.offsetWidth; t.classList.add("fill-anim"); }
      store.write(sel, { water: next }, { debounce: 450 });
      return;
    }
    const key = t.dataset.task;
    if (!key || key === "water") return;
    if (key === "photo") return startPhoto(sel, t);
    const e = store.entry(sel) ?? blank(sel);
    const on = !e[key];
    haptic(on ? "light" : "light");
    if (on) ripple(t, ev);
    store.write(sel, { [key]: on });
  });
}

function ripple(el, ev) {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const x = (ev.clientX || r.left + r.width - 30) - r.left - size / 2;
  const y = (ev.clientY || r.top + r.height / 2) - r.top - size / 2;
  const s = document.createElement("span");
  s.className = "ripple";
  s.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  el.appendChild(s);
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  setTimeout(() => s.remove(), 700);
}

/** Update every dynamic bit in place so CSS transitions play. */
export function paint(root, selIn) {
  const me = store.me;
  if (!$("[data-ring]", root)) return;
  const sel = selIn ?? store.selDay ?? me.today;
  const s = store.stats(me);
  const e = store.entry(sel) ?? blank(sel);
  const complete = isComplete(e);
  const isToday = sel === me.today;

  for (const t of TASKS) {
    const el = $(`[data-task="${t.key}"]`, root);
    const on = taskDone(e, t.key);
    el.classList.toggle("on", on);
    if (el.tagName === "BUTTON") el.setAttribute("aria-pressed", String(on));
    let meta = t.meta;
    if (t.key === "water") meta = [`${e.water} of ${WATER_GOAL}`, `${e.water * OZ_PER_BOTTLE} of ${WATER_GOAL * OZ_PER_BOTTLE} oz`];
    if (t.key === "photo") meta = photoMeta(on);
    if ((t.key === "w1" || t.key === "w2") && complete && !(e.w1 && e.w2) && !on) meta = [...t.meta, "Skipped, still counts"];
    $("[data-meta]", el).innerHTML = metaHtml(meta);
    $(`[data-seg="${t.key}"]`, root).classList.toggle("on", on);
  }
  $$("[data-bottle]", root).forEach((b, i) => b.classList.toggle("full", i < e.water));
  const pace = $("[data-pace]", root);
  if (pace) {
    const want = isToday ? waterPace() : 0;
    pace.textContent = e.water >= WATER_GOAL ? "Gallon done" : isToday && e.water < want - 1 ? `Aim for ${want} by now` : "";
  }

  $("[data-ringn]", root).innerHTML = `${doneCount(e)}<small>/6</small>`;
  $("[data-ring]", root).classList.toggle("complete", complete);

  const pills = [];
  if (complete) pills.push(`<span class="pill pill-me">${icon("check", "", 2.6)}Day complete</span>`);
  if (complete && isOneWorkout(e)) pills.push(`<span class="pill">1 workout</span>`);
  if (!complete && !isToday) pills.push(`<span class="pill pill-warn">Not complete · +1 day</span>`);
  if (!complete && isToday) {
    const left = 6 - doneCount(e);
    pills.push(`<span class="pill">${left} to go</span>`);
  }
  $("[data-heropills]", root).innerHTML = pills.join("");

  const st = $("[data-streak]", root);
  st.classList.toggle("hide", s.streak < 2);
  $("span", st).textContent = `${s.streak} day streak`;

  // strip statuses
  for (const d of s.days) {
    const c = $(`[data-day="${d.day}"]`, root);
    if (!c) continue;
    c.className = `chip-day ${d.status}${d.day === sel ? " sel" : ""}`;
    c.setAttribute("aria-selected", String(d.day === sel));
  }

  // partner chip
  const pc = $(".partner-chip", root);
  if (pc) {
    const p = store.partner;
    const pe = p.entries.find((x) => x.day === p.today);
    const n = doneCount(pe);
    const pdone = isComplete(pe);
    pc.innerHTML = `<span class="avatar ${p.id}" style="width:34px;height:34px;font-size:19px">${esc(p.name[0])}</span>
      <span style="min-width:0"><div class="who">${esc(p.name)}</div>
      <div class="what">${pdone ? (isOneWorkout(pe) ? "Done today · 1 workout" : "Done for today") : n ? `${n} of 6 today` : "Nothing checked yet today"}</div></span>
      <span class="bars">${TASKS.map((t) => `<i class="${taskDone(pe, t.key) ? "on" : ""}"></i>`).join("")}</span>
      ${icon("chevR", "chev")}`;
  }

  // stats
  $("[data-stats]", root).innerHTML = `
    <div class="stat"><div class="eyebrow">Completed</div>
      <div class="num v">${s.completed}<small>/${TOTAL}</small></div>
      <div class="sub">${s.finished ? "75 done" : `${s.left} to go`}</div></div>
    <div class="stat"><div class="eyebrow">Days added</div>
      <div class="num v">${s.added ? "+" + s.added : "0"}</div>
      <div class="sub">${s.added ? "No restarts" : "Clean so far"}</div></div>
    <div class="stat"><div class="eyebrow">1-workout days</div>
      <div class="num v">${s.oneWorkout}</div>
      <div class="sub">Still count</div></div>
    <div class="stat"><div class="eyebrow">Finish</div>
      <div class="num v date">${esc(fmtMD(s.finish).toUpperCase())}</div>
      <div class="sub">${esc(fmtWdShort(s.finish))}${s.finished ? " · done" : " · projected"}</div></div>`;
}
