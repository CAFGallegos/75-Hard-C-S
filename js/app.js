import { store } from "./store.js";
import { getKey, makeApi, errorText } from "./api.js";
import { icon } from "./icons.js";
import { $, $$, esc, haptic, toast } from "./util.js";
import { paintTheme } from "./theme.js";
import { renderToday, paint as paintToday } from "./views/today.js";
import { renderBoard } from "./views/board.js";
import { renderPhotos, invalidatePhotos } from "./views/photos.js";
import { renderSettings } from "./views/settings.js";
import { showWelcome } from "./views/welcome.js";
import { checkShortcutReturn } from "./photo.js";
import { syncPush } from "./push.js";
import { openNudgeSheet } from "./nudges.js";

paintTheme();

const app = document.getElementById("app");
const VIEWS = { today: renderToday, board: renderBoard, photos: renderPhotos, settings: renderSettings };
const TABS = [
  ["today", "Today", "today"],
  ["board", "Board", "board"],
  ["photos", "Photos", "photos"],
  ["settings", "You", "settings"],
];

let main = null;
let current = null; // current view container
let lastPhotoCount = null;
let nudgeOnOpen = false; // hidden widget feature: tapping the other person's half opens a nudge

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "nav" && store.data && main && e.data.tab) {
      store.selDay = null;
      show(e.data.tab);
      store.refresh().catch(() => {});
    }
  });
}

function markHtml(size = "") {
  return `<span class="mark" ${size}><span class="s">S</span><span class="v">v</span><span class="c">C</span></span>`;
}

function fullMessage({ title, body, action }) {
  app.innerHTML = `<div class="fullmsg">${markHtml()}
    <h1 class="h1">${esc(title)}</h1><p class="body">${esc(body)}</p>
    ${action ? `<button class="btn btn-primary" data-act>${action.label}</button>` : ""}</div>`;
  if (action) $("[data-act]", app).onclick = action.run;
}

function shell() {
  app.innerHTML = `<main id="main" class="shell"></main>
    <nav class="tabbar" aria-label="Sections"><div class="tabbar-inner">
      ${TABS.map(([id, label, ic]) => `<button class="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join("")}
    </div></nav>`;
  main = $("#main", app);
  $(".tabbar", app).addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    haptic();
    if (t.dataset.tab === store.view) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (store.view === "today" && store.selDay) { store.selDay = null; show("today"); }
      return;
    }
    show(t.dataset.tab);
  });
}

function show(view, { keepScroll = false } = {}) {
  if (!main) shell();
  store.view = view;
  $$(".tab", app).forEach((t) => (t.dataset.tab === view ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")));
  const y = window.scrollY;
  current = document.createElement("div");
  main.replaceChildren(current);
  VIEWS[view](current);
  if (keepScroll) {
    current.firstElementChild?.style.setProperty("animation", "none");
    window.scrollTo(0, y);
  } else window.scrollTo(0, 0);
}

store.on((kind) => {
  if (!store.data || !main) return;
  if (kind.startsWith("nav:")) return show(kind.slice(4));
  if (kind === "welcome") return showWelcome({ onDone: () => show(store.view, { keepScroll: true }) });
  if (kind === "rerender") return show(store.view, { keepScroll: true });
  const pc = store.data.me.photo_count;
  if (lastPhotoCount !== null && pc !== lastPhotoCount) invalidatePhotos();
  lastPhotoCount = pc;
  if (kind === "entry") {
    if (store.view === "today") paintToday(current);
    return;
  }
  if (kind === "data") {
    if (store.view === "today") {
      // Re-render only if the day list changed (new day, start date moved); otherwise paint in place.
      const chips = $$("[data-day]", current).length;
      const want = store.stats(store.me).days.length;
      if (!$("[data-ring]", current) || chips !== want) show("today", { keepScroll: true });
      else paintToday(current);
    } else if (store.view === "board" || store.view === "settings") {
      show(store.view, { keepScroll: true });
    }
  }
});

async function handleUrlActions() {
  const url = new URL(location.href);
  let changed = false;
  if (url.searchParams.get("tab")) {
    const t = url.searchParams.get("tab");
    if (VIEWS[t]) store.view = t;
    url.searchParams.delete("tab");
    changed = true;
  }
  if (url.searchParams.get("nudge") === "1") {
    nudgeOnOpen = true;
    store.view = "board";
    url.searchParams.delete("nudge");
    changed = true;
  }
  if (url.searchParams.get("photo") === "done") {
    url.searchParams.delete("photo");
    changed = true;
    try {
      const d = await store.api("photo_return");
      store.setData(d, { quiet: true });
      setTimeout(() => toast(d.marked ? "Photo saved to your album. Marked done." : "Back from the Shortcut.", { ico: "check" }), 500);
      haptic("success");
    } catch (err) {
      toast(errorText(err), { error: true });
    }
  }
  if (changed) history.replaceState(null, "", url.toString());
}

async function boot() {
  const k = getKey();
  if (!k) {
    return fullMessage({
      title: "This one's private.",
      body: "Open the personal link Carlos sent you. It has your key in it.",
    });
  }
  store.k = k;
  store.api = makeApi(k);

  // Paint instantly from the last known state, then refresh.
  const cached = store.cached();
  let painted = false;
  if (cached && cached.me) {
    store.setData(cached, { quiet: true });
    if (cached.me.onboarded && !new URL(location.href).searchParams.get("photo")) {
      shell();
      show(store.view);
      painted = true;
    }
  }

  try {
    await handleUrlActions();
    const d = await store.api("state");
    store.setData(d, { quiet: true });
  } catch (err) {
    if (err.code === "bad_key") {
      try { localStorage.removeItem("k75"); localStorage.removeItem("s75"); } catch (_) {}
      return fullMessage({ title: "This link doesn't work.", body: "Ask Carlos for your private link. It's the one with the long key at the end." });
    }
    if (!painted) {
      return fullMessage({
        title: "Can't reach the server.",
        body: err.code === "offline" ? "Looks like you're offline. Check your connection and try again." : "Something went wrong on our end. Give it another try.",
        action: { label: "Try again", run: () => { app.innerHTML = ""; boot(); } },
      });
    }
    toast(errorText(err), { error: true });
    return;
  }

  lastPhotoCount = store.data.me.photo_count;
  if (!painted) shell();
  show(store.view, { keepScroll: painted });
  if (!store.data.me.onboarded) showWelcome({ onDone: () => show("today") });
  else if (nudgeOnOpen && store.data.nudges?.partner_on) setTimeout(() => openNudgeSheet({ onSent: () => show("board", { keepScroll: true }) }), 350);
  nudgeOnOpen = false;
  syncPush();
}

// Easter egg: long-press the S v C mark.
(() => {
  let timer = null, startXY = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  document.addEventListener("pointerdown", (e) => {
    const mark = e.target.closest?.(".mark");
    if (!mark) return;
    startXY = [e.clientX, e.clientY];
    timer = setTimeout(() => {
      timer = null;
      haptic("success");
      document.querySelectorAll(".egg").forEach((x) => x.remove());
      const r = mark.getBoundingClientRect();
      const egg = document.createElement("div");
      egg.className = "egg";
      egg.textContent = "Te quiero enana";
      egg.style.left = `${r.right + 10}px`;
      egg.style.top = `${r.top + r.height / 2 - 14}px`;
      document.body.appendChild(egg);
      setTimeout(() => egg.remove(), 1700);
    }, 550);
  });
  document.addEventListener("pointermove", (e) => {
    if (timer && startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 10) cancel();
  });
  ["pointerup", "pointercancel", "scroll"].forEach((ev) => document.addEventListener(ev, cancel, true));
  document.addEventListener("contextmenu", (e) => { if (e.target.closest?.(".mark")) e.preventDefault(); });
})();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !store.data) return;
  checkShortcutReturn();
  if (Date.now() - store.lastFetch > 20_000) store.refresh().catch(() => {});
});

// Day rollover while the app sits open.
setInterval(() => {
  if (document.visibilityState === "visible" && store.data && Date.now() - store.lastFetch > 5 * 60_000) {
    store.refresh().catch(() => {});
  }
}, 60_000);

boot();
