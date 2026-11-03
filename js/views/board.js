import { store } from "../store.js";
import { TASKS, TOTAL, WATER_GOAL, taskDone, doneCount, isComplete, isOneWorkout, addDays, dayNum } from "../rules.js";
import { icon } from "../icons.js";
import { esc, fmtShort, fmtMD } from "../util.js";
import { voice, boardNote } from "../voice.js";

const ORDER = ["sue", "los"]; // S v C

function todayStatus(p, s) {
  if (!s.started) return { label: "Not started", cls: "" };
  const e = p.entries.find((x) => x.day === p.today);
  if (isComplete(e)) return { label: isOneWorkout(e) ? "Done · 1 workout" : "Done today", cls: "pill-me", me: true };
  const n = doneCount(e);
  return { label: n ? `${n} of 6 today` : "Not started today", cls: "" };
}

function grid(p, s) {
  const total = TOTAL + s.added;
  const cells = [];
  const byDay = new Map(s.days.map((d) => [d.day, d.status]));
  for (let i = 0; i < Math.max(total, TOTAL); i++) {
    const d = addDays(store.start, i);
    let st = byDay.get(d) ?? "future";
    if (st === "future" && i >= TOTAL) st = "extra";
    cells.push(`<i class="cell ${st}" title="Day ${i + 1} · ${esc(fmtShort(d))}"></i>`);
  }
  // Fill out the last row so the grid stays rectangular.
  while (cells.length % 15) cells.push(`<i class="cell" style="visibility:hidden"></i>`);
  return cells.join("");
}

function card(p) {
  const s = store.stats(p);
  const st = todayStatus(p, s);
  const e = p.entries.find((x) => x.day === p.today);
  const isMe = p.id === store.data.me.id;
  return `<article class="card pcard ${p.id}">
    <div class="pcard-head">
      <span class="avatar ${p.id}">${esc(p.name[0])}</span>
      <div class="who"><div class="h3">${esc(p.name)}${isMe ? '<span class="muted" style="font-weight:500;font-size:13px">You</span>' : ""}</div>
        <div class="small">${s.started ? `Day ${s.dayNumber} · ${esc(p.tz.split("/")[1].replace("_", " "))} time` : `Starts ${esc(fmtShort(store.start))}`}</div></div>
      <span class="pill ${st.cls}" style="${st.me ? `background:color-mix(in srgb,var(--${p.id}) 16%,transparent);color:var(--${p.id}-ink)` : ""}">${esc(st.label)}</span>
    </div>
    ${!isMe && p.diet ? `<p class="diet-rule"><span>Diet ·</span> ${esc(p.diet)}</p>` : ""}
    <div class="today-icons" aria-label="Today">
      ${TASKS.map((t) => {
        if (t.key === "water") {
          const lvl = Math.min(1, (e?.water ?? 0) / WATER_GOAL);
          return `<div class="ti ti-water ${lvl >= 1 ? "on" : ""}" title="Water ${e?.water ?? 0}/8"><span class="lvl" style="height:${lvl * 100}%"></span>${icon(t.icon)}</div>`;
        }
        return `<div class="ti ${taskDone(e, t.key) ? "on" : ""}" title="${t.title}">${icon(t.icon)}</div>`;
      }).join("")}
    </div>
    <div class="kv">
      <div><div class="eyebrow">Done</div><div class="num v">${s.completed}</div></div>
      <div><div class="eyebrow">Added</div><div class="num v">${s.added ? "+" + s.added : 0}</div></div>
      <div><div class="eyebrow">1-workout</div><div class="num v">${s.oneWorkout}</div></div>
      <div><div class="eyebrow">Streak</div><div class="num v">${s.streak}</div></div>
    </div>
    <div class="grid75">${grid(p, s)}</div>
    <div class="pcard-foot"><span>Projected finish${s.added ? ` · +${s.added} day${s.added > 1 ? "s" : ""}` : ""}</span><b style="color:var(--t1);font-weight:600">${esc(fmtShort(s.finish))}</b></div>
  </article>`;
}

export function renderBoard(root) {
  const people = ORDER.map((id) => store.person(id)).filter(Boolean);
  const [a, b] = people.map((p) => ({ p, s: store.stats(p) }));
  const meId = store.data.me.id;
  const mine = (a.p.id === meId ? a : b).s, theirs = (a.p.id === meId ? b : a).s;
  const note = boardNote(meId, mine, theirs);
  const lead = a.s.completed === b.s.completed ? "Dead even" : `${(a.s.completed > b.s.completed ? a : b).p.name} is up ${Math.abs(a.s.completed - b.s.completed)}`;

  root.innerHTML = `<div class="view">
    <div class="topbar"><span class="mark"><span class="s">S</span><span class="v">v</span><span class="c">C</span></span>
      <span class="pill">${a.s.started ? esc(lead) : `Day 1 · ${esc(fmtMD(store.start))}`}</span></div>
    <header class="page-head"><span class="eyebrow">${esc(voice(meId).board)}</span><h1 class="h1">The board</h1></header>
    <section class="card vs">
      <div class="side"><span class="name c-sue">${esc(a.p.name)}</span><span class="num score c-sue">${a.s.completed}<small>/${a.s.target}</small></span></div>
      <span class="mid">v</span>
      <div class="side right"><span class="name c-los">${esc(b.p.name)}</span><span class="num score c-los">${b.s.completed}<small>/${b.s.target}</small></span></div>
      <div class="vs-bar" style="grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <i style="background:var(--t4);position:relative;overflow:hidden"><b style="position:absolute;inset:0 auto 0 0;width:${Math.min(100, (a.s.completed / a.s.target) * 100)}%;background:var(--sue);border-radius:3px"></b></i>
        <i style="background:var(--t4);position:relative;overflow:hidden"><b style="position:absolute;inset:0 0 0 auto;width:${Math.min(100, (b.s.completed / b.s.target) * 100)}%;background:var(--los);border-radius:3px"></b></i>
      </div>
      <div class="meta" style="grid-column:1/2;margin-top:12px">${a.s.added ? `+${a.s.added} added` : "Nothing added"}</div>
      <div class="meta" style="grid-column:3/4;margin-top:12px;text-align:right">${b.s.added ? `+${b.s.added} added` : "Nothing added"}</div>
      ${note ? `<p class="note vs-note">${esc(note)}</p>` : ""}
    </section>
    <section class="section">
      ${people.map(card).join("")}
      <div class="legend">
        <span><i class="cell done" style="--pc:var(--t2)"></i>Complete</span>
        <span><i class="cell one" style="--pc:var(--t2)"></i>1 workout</span>
        <span><i class="cell missed"></i>Missed (+${store.penalty} day${store.penalty > 1 ? "s" : ""})</span>
        <span><i class="cell"></i>Ahead</span>
      </div>
    </section>
    <p class="foot-note">Partners see check marks only. Never photos.</p>
  </div>`;
}

export { dayNum };
