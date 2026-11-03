// 75 Hard · S v C — home screen widget for Scriptable (free, App Store).
// Setup: see "Home screen widget" in the README. Paste your private key (the part after
// ?k= in your link) into the widget's Parameter field. Same script for both of us.
// Read only: it fetches state from the api and never writes anything.
//
// Design rule: it must read in normal, dark AND tinted/clear home screens. In tinted mode iOS
// paints everything in one tint color (keeping transparency), so: no filled boxes or bars,
// people are labeled by name (not just color), and "done" vs "not done" is told apart by
// shape (filled vs outline SF Symbols), with dimming as a second cue.

const API = "https://axbjvkkcqardmkircknn.supabase.co/functions/v1/api";
const APP = "https://cafgallegos.github.io/75-Hard-C-S/";
const REFRESH_MIN = 30;

const C = {
  bg: new Color("#0A0A0A"),
  t1: new Color("#F6F3F0"),
  t2: new Color("#F6F3F0", 0.62),
  t3: new Color("#F6F3F0", 0.4),
  t4: new Color("#F6F3F0", 0.13),
  sue: new Color("#F5B3C4"),
  los: new Color("#C08A63"),
};
const F = {
  num: (s) => new Font("AvenirNextCondensed-Heavy", s),
  logo: (s) => new Font("AvenirNextCondensed-Heavy", s),
  v: (s) => new Font("AvenirNextCondensed-DemiBoldItalic", s),
  vThin: (s) => new Font("AvenirNextCondensed-Italic", s),
  label: (s) => Font.semiboldSystemFont(s),
  body: (s) => Font.systemFont(s),
  light: (s) => Font.lightSystemFont(s),
};

const key = (args.widgetParameter || "").trim().replace(/^.*[?&]k=/, "");
const family = config.widgetFamily || "medium";

// ------------------------------------------------------------------ data
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), `75hard-${key.slice(0, 8) || "none"}.json`);

async function load() {
  if (!key) return { error: "nokey" };
  try {
    const req = new Request(API);
    req.method = "POST";
    req.headers = { "Content-Type": "text/plain;charset=UTF-8" };
    req.body = JSON.stringify({ k: key, a: "state" });
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    const code = req.response && req.response.statusCode;
    if (code === 401) return { error: "badkey" };
    if (!data || !data.me) throw new Error("bad response");
    const saved = { at: Date.now(), data };
    fm.writeString(cachePath, JSON.stringify(saved));
    return { data, at: saved.at, stale: false };
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      const saved = JSON.parse(fm.readString(cachePath));
      return { data: saved.data, at: saved.at, stale: true };
    }
    return { error: "offline" };
  }
}

// ------------------------------------------------------------------ pieces
function logo(stack, size) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.bottomAlignContent();
  row.spacing = 2;
  const s = row.addText("S"); s.font = F.logo(size); s.textColor = C.sue;
  const v = row.addText("v"); v.font = F.v(size * 0.55); v.textColor = C.t3;
  const c = row.addText("C"); c.font = F.logo(size); c.textColor = C.los;
  return row;
}

function text(stack, str, font, color, opts = {}) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  if (opts.lines) t.lineLimit = opts.lines;
  if (opts.scale) t.minimumScaleFactor = opts.scale;
  if (opts.align === "right") t.rightAlignText();
  return t;
}

// Same six tasks and icons as the app: workout, outdoor workout, diet, water, read, photo.
// Not done: outline symbol, dim. Done: filled symbol in that person's color.
const TASKS = [
  { key: "w1", sym: "dumbbell" },
  { key: "w2", sym: "mountain.2" },
  { key: "diet", sym: "leaf" },
  { key: "water", sym: "drop" },
  { key: "read", sym: "book" },
  { key: "photo", sym: "camera" },
];
const WATER_GOAL = 8;

function symbol(names, size) {
  for (const n of names) {
    const s = SFSymbol.named(n);
    if (s) {
      s.applyFont(Font.systemFont(size));
      return s.image;
    }
  }
  return null;
}

/** One row of six task icons for a person's day. Mirrored: right-aligned, camera on the inside. */
function taskIcons(stack, entry, color, size = 15, gap = 7, mirror = false) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = gap;
  if (mirror) row.addSpacer();
  for (const t of mirror ? [...TASKS].reverse() : TASKS) {
    let names, on;
    if (t.key === "water") {
      const w = (entry && entry.water) || 0;
      on = w >= WATER_GOAL;
      // Fills partway as the bottles go in, full at 128 oz.
      names = on ? ["drop.fill"] : w > 0 ? ["drop.halffull", "drop"] : ["drop"];
      if (!on && w > 0) on = "partial";
    } else {
      on = !!(entry && entry[t.key]);
      names = on ? [`${t.sym}.fill`, t.sym] : [t.sym];
    }
    const img = symbol(names, size);
    if (!img) continue;
    const el = row.addImage(img);
    el.imageSize = new Size(size, size);
    el.tintColor = on === true ? color : on === "partial" ? color : C.t3;
  }
  return row;
}

/** Today's entry for a person, from the same state the app uses. */
function todayEntry(d, id) {
  const p = d.people.find((x) => x.id === id);
  return p ? (p.entries || []).find((e) => e.day === p.today) : null;
}

const fmtMD = (iso) => {
  const d = new Date(iso + "T12:00:00Z");
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${m} ${d.getUTCDate()}`;
};
const fmtTime = (ms) => {
  const df = new DateFormatter();
  df.dateFormat = "h:mma";
  return df.string(new Date(ms)).toLowerCase();
};

function updated(stack, res) {
  if (!res.stale) return;
  text(stack, `Updated ${fmtTime(res.at)}`, F.light(9), C.t3, { align: "right" });
}

function line(stack, str, size, lines) {
  if (!str) return;
  const t = text(stack, str, F.light(size), C.t2, { lines, scale: 0.8 });
  return t;
}

/** Medium widget width in points for this phone (Apple's sizes by screen width). */
function mediumWidth() {
  const sw = Math.min(Device.screenSize().width, Device.screenSize().height);
  if (sw <= 320) return 292;
  if (sw <= 375) return 329;
  if (sw <= 393) return 338;
  return 360;
}

// ------------------------------------------------------------------ layouts
function small(w, res) {
  const d = res.data;
  const me = d.me.id;
  const s = d.summary[me];
  const color = C[me];
  w.setPadding(14, 14, 12, 14);

  const top = w.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();
  logo(top, 20);
  top.addSpacer();
  if (res.stale) updated(top, res);
  else if (s.started) text(top, `${s.done_today}/6`, F.label(12), s.complete_today ? color : C.t2);

  w.addSpacer(6);
  if (s.started) {
    text(w, "DAY", F.label(9), C.t3);
    const big = w.addStack();
    big.layoutHorizontally();
    big.bottomAlignContent();
    text(big, String(s.day), F.num(46), C.t1);
    big.addSpacer(3);
    text(big, `/${75 + s.added}`, F.num(16), C.t3); // total days incl. added
    w.addSpacer(5);
    taskIcons(w, todayEntry(d, me), color, 15, 6);
  } else {
    text(w, "DAY 1", F.label(9), C.t3);
    text(w, fmtMD(d.start_date), F.num(34), C.t1);
  }
  w.addSpacer();
  line(w, d.daily_line, 10, 2);
}

function medium(w, res) {
  const d = res.data;
  const meId = d.me.id;
  const order = [meId, ...d.people.map((p) => p.id).filter((id) => id !== meId)];
  const name = (id) => (d.people.find((p) => p.id === id) || {}).name || id;
  w.setPadding(14, 16, 12, 16);

  const top = w.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();
  logo(top, 18);
  top.addSpacer(8);
  const s0 = d.summary[meId];
  text(top, s0.started ? `DAY ${s0.day}` : `DAY 1 · ${fmtMD(d.start_date).toUpperCase()}`, F.label(10), C.t3);
  top.addSpacer();
  updated(top, res);

  w.addSpacer(8);
  // Head to head: the viewer on the left, the other person mirrored on the right,
  // meeting at a hairline with a thin "v" level with the big numbers.
  const row = w.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  const gap = 8, midW = 12;
  const colW = Math.floor((mediumWidth() - 32 - gap * 2 - midW) / 2);
  const both = order.every((id) => d.summary[id].complete_today);
  column(row, d, order[0], name(order[0]), colW, false);
  row.addSpacer(gap);
  divider(row, midW, both);
  row.addSpacer(gap);
  const other = column(row, d, order[1], name(order[1]), colW, true);
  // Hidden feature: tap the other person's half to open the app straight to a nudge for them.
  if (key) other.url = `${APP}?k=${encodeURIComponent(key)}&tab=board&nudge=1`;

  w.addSpacer();
  // Today's line, centered across the bottom.
  const foot = w.addStack();
  foot.layoutHorizontally();
  foot.addSpacer();
  const ln = line(foot, d.daily_line, 10.5, 1);
  if (ln) ln.centerAlignText();
  foot.addSpacer();
}

/** A horizontal row inside a column; mirrored rows are pushed to the outer (right) edge. */
function crow(col, mirror) {
  const r = col.addStack();
  r.layoutHorizontally();
  r.bottomAlignContent();
  if (mirror) r.addSpacer();
  return r;
}

/** One person's half. Mirrored = the right side: every row flush right, reading inward. */
function column(row, d, id, nm, width, mirror) {
  const s = d.summary[id];
  const col = row.addStack();
  col.layoutVertically();
  col.size = new Size(width, 0);

  const head = col.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  const nameEl = () => text(head, nm.toUpperCase(), F.label(10), C[id]);
  const prog = () => text(head, `${s.done_today}/6`, F.label(10), s.complete_today ? C[id] : C.t2);
  if (mirror) { prog(); head.addSpacer(); nameEl(); } else { nameEl(); head.addSpacer(); prog(); }

  col.addSpacer(1);
  const big = crow(col, mirror);
  if (mirror) {
    text(big, `/${s.target} done`, F.label(9), C.t3);
    big.addSpacer(3);
    text(big, String(s.completed), F.num(30), C.t1);
  } else {
    text(big, String(s.completed), F.num(30), C.t1);
    big.addSpacer(3);
    text(big, `/${s.target} done`, F.label(9), C.t3);
  }

  col.addSpacer(4);
  taskIcons(col, todayEntry(d, id), C[id], 15, 7, mirror);
  col.addSpacer(5);
  const fin = crow(col, mirror);
  text(fin, `Finish ${fmtMD(s.finish)}${s.added ? ` · +${s.added}` : ""}`, F.label(9.5), C.t2, { lines: 1, scale: 0.8 });
  return col;
}

/** The center line with a small thin "v" on it, level with the big numbers. */
function divider(row, width, both) {
  const mid = row.addStack();
  mid.layoutVertically();
  mid.centerAlignContent();
  mid.size = new Size(width, 0);
  const seg = (h) => {
    const l = mid.addStack();
    l.size = new Size(1, h);
    l.backgroundColor = C.t4;
  };
  seg(17);
  mid.addSpacer(3);
  if (both) {
    // You both closed out today: the "v" quietly turns into a heart.
    const img = symbol(["heart.fill", "heart"], 9);
    if (img) {
      const h = mid.addImage(img);
      h.imageSize = new Size(10, 10);
      h.tintColor = C.sue;
    }
  } else {
    text(mid, "v", F.vThin(13), C.t3);
  }
  mid.addSpacer(3);
  seg(34);
}



function message(w, title, body) {
  w.setPadding(14, 14, 14, 14);
  logo(w, 18);
  w.addSpacer();
  text(w, title, F.label(12), C.t1, { lines: 2 });
  w.addSpacer(3);
  text(w, body, F.light(10), C.t2, { lines: 3, scale: 0.8 });
}

// ------------------------------------------------------------------ main
const res = await load();
const w = new ListWidget();
w.backgroundColor = C.bg;
w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
if (key) w.url = `${APP}?k=${encodeURIComponent(key)}`;

if (res.error === "nokey") message(w, "Add your key", "Long-press the widget, Edit Widget, and paste your key into Parameter.");
else if (res.error === "badkey") message(w, "That key didn't work", "Paste the part of your link after ?k= into Parameter.");
else if (res.error === "offline") message(w, "Offline", "It'll fill in once you're back online.");
else if (family === "small") small(w, res);
else medium(w, res);

if (config.runsInWidget) Script.setWidget(w);
else if (family === "small") await w.presentSmall();
else await w.presentMedium();
Script.complete();
