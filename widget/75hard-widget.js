// 75 Hard · S v C — home screen widget for Scriptable (free, App Store).
// Setup: see "Home screen widget" in the README. Paste your private key (the part after
// ?k= in your link) into the widget's Parameter field. Same script for both of us.
// Read only: it fetches state from the api and never writes anything.

const API = "https://axbjvkkcqardmkircknn.supabase.co/functions/v1/api";
const APP = "https://cafgallegos.github.io/75-Hard-C-S/";
const REFRESH_MIN = 30;

const C = {
  bg: new Color("#0A0A0A"),
  card: new Color("#161515"),
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

/** Six little bars for today's tasks. */
function segments(stack, done, color, w = 13, h = 5, gap = 3) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.spacing = gap;
  for (let i = 0; i < 6; i++) {
    const b = row.addStack();
    b.size = new Size(w, h);
    b.cornerRadius = h / 2;
    b.backgroundColor = i < done ? color : C.t4;
  }
  return row;
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
    w.addSpacer(4);
    segments(w, s.done_today, color, 15, 5, 3);
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
  const row = w.addStack();
  row.layoutHorizontally();
  row.spacing = 10;
  const colW = (mediumWidth() - 32 - 10) / 2;
  order.forEach((id) => {
    const s = d.summary[id];
    const col = row.addStack();
    col.layoutVertically();
    col.backgroundColor = C.card;
    col.cornerRadius = 12;
    col.setPadding(8, 10, 8, 10);
    col.size = new Size(colW, 0);
    const head = col.addStack();
    head.layoutHorizontally();
    head.centerAlignContent();
    text(head, name(id).toUpperCase(), F.label(10), C[id]);
    head.addSpacer();
    text(head, `${s.done_today}/6`, F.label(10), s.complete_today ? C[id] : C.t3);
    const big = col.addStack();
    big.layoutHorizontally();
    big.bottomAlignContent();
    text(big, String(s.completed), F.num(30), C.t1);
    big.addSpacer(2);
    text(big, `/${s.target} done`, F.label(9), C.t3);
    col.addSpacer(3);
    segments(col, s.done_today, C[id], 15, 4, 3);
    col.addSpacer(4);
    text(col, `Finish ${fmtMD(s.finish)}${s.added ? ` · +${s.added}` : ""}`, F.label(9.5), C.t2, { lines: 1, scale: 0.8 });
  });

  w.addSpacer();
  line(w, d.daily_line, 10.5, 1);
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
