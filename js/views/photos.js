import { store } from "../store.js";
import { icon } from "../icons.js";
import { $, $$, esc, fmtShort, fmtMD, haptic, toast, confirmSheet } from "../util.js";
import { errorText } from "../api.js";
import { MODES, startPhoto, shortcutGuide } from "../photo.js";
import { dayNum, blank } from "../rules.js";

let photos = null; // [{id, day, url}]
let fetchedAt = 0;
let selecting = false;
const picked = new Set();

const privacy = `<div class="privacy">${icon("lock")}<span>Only you can see your photos.</span></div>`;

function header(sub) {
  return `<div class="topbar"><span class="mark"><span class="s">S</span><span class="v">v</span><span class="c">C</span></span>${sub ?? ""}</div>
    <header class="page-head"><span class="eyebrow">Progress photos</span><h1 class="h1">Photos</h1></header>`;
}

function todayCta() {
  const me = store.me;
  const s = store.stats(me);
  if (!s.started) return `<p class="small" style="text-align:center;margin-top:14px">First photo is Day 1, ${esc(fmtShort(store.start))}.</p>`;
  const e = store.entry(me.today) ?? blank(me.today);
  return e.photo
    ? `<div class="ok-line">${icon("check", "", 2.4)}Today's photo is done</div>`
    : `<button class="btn btn-me btn-block" data-take style="margin-top:14px">${icon("photo")}Take today's photo</button>`;
}

function modeCard(mode) {
  const m = MODES[mode];
  return `<div class="card card-pad" style="display:flex;gap:14px;align-items:flex-start">
    <div class="task-ico" style="background:color-mix(in srgb,var(--me) 16%,transparent);color:var(--me-ink)">${icon(m.icon)}</div>
    <div style="flex:1;min-width:0"><div class="eyebrow" style="margin-bottom:6px">Your setting</div>
      <div class="h3">${esc(m.title)}</div><p class="small" style="margin:4px 0 0">${esc(m.desc)}</p></div></div>`;
}

export function renderPhotos(root) {
  const mode = store.data.me.photo_mode;
  if (mode !== "cloud") return renderLocal(root, mode);

  root.innerHTML = `<div class="view">
    ${header(`<button class="link-btn" data-select ${photos?.length ? "" : 'style="visibility:hidden"'}>${selecting ? "Cancel" : "Select"}</button>`)}
    ${privacy}
    <div data-body style="margin-top:18px">${photos ? "" : `<div class="skel" style="aspect-ratio:3/2"></div><div class="skel" style="height:120px;margin-top:12px"></div>`}</div>
  </div>`;
  if (photos) paintCloud(root);
  if (!photos || Date.now() - fetchedAt > 200_000) load(root);
  wireCloud(root);
}

async function load(root) {
  try {
    const r = await store.api("photos");
    photos = r.photos;
    fetchedAt = Date.now();
    if (root.isConnected) {
      $("[data-select]", root).style.visibility = photos.length ? "" : "hidden";
      paintCloud(root);
    }
  } catch (err) {
    if (root.isConnected) {
      $("[data-body]", root).innerHTML = `<div class="empty"><div class="art">${icon("wifiOff")}</div>
        <h2 class="h2">Couldn't load photos</h2><p class="body">${esc(errorText(err))}</p>
        <button class="btn btn-ghost" data-retry>${icon("refresh")}Try again</button></div>`;
    }
  }
}

export function invalidatePhotos() { photos = null; fetchedAt = 0; }

function paintCloud(root) {
  const body = $("[data-body]", root);
  if (!photos.length) {
    body.innerHTML = `<div class="empty"><div class="art">${icon("photo")}</div>
      <h2 class="h2">No photos yet</h2>
      <p class="body">One a day. By day 75 you'll have the whole story, side by side.</p></div>${todayCta()}`;
    return;
  }
  const first = photos[0];
  const last = photos[photos.length - 1];
  const same = first.id === last.id;
  body.innerHTML = `
    <div class="compare">
      <figure><img src="${esc(first.url)}" alt="Day ${dayNum(store.start, first.day)}"><figcaption>Day ${dayNum(store.start, first.day)}</figcaption></figure>
      <figure>${same
        ? `<div class="ph">Your next photo shows up here, next to day ${dayNum(store.start, first.day)}.</div>`
        : `<img src="${esc(last.url)}" alt="Latest"><figcaption>Day ${dayNum(store.start, last.day)} · ${esc(fmtMD(last.day))}</figcaption>`}</figure>
    </div>
    ${todayCta()}
    <section class="section ${selecting ? "selecting" : ""}" data-grid-wrap>
      <span class="eyebrow">Timeline · ${photos.length}</span>
      <div class="pgrid">${[...photos].reverse().map((p) => `<button class="ptile ${picked.has(p.id) ? "picked" : ""}" data-pid="${p.id}" aria-label="Day ${dayNum(store.start, p.day)}">
        <img src="${esc(p.url)}" alt="" loading="lazy" onload="this.classList.add('ld')"><span class="lbl">Day ${dayNum(store.start, p.day)}</span><span class="sel"></span></button>`).join("")}</div>
      ${selecting
        ? `<div class="sel-bar"><button class="btn btn-danger btn-block" data-del-sel ${picked.size ? "" : "disabled"}>${icon("trash")}Delete ${picked.size || ""}</button></div>`
        : ""}
    </section>
    <section class="section">
      <button class="btn btn-block btn-danger" data-del-all>${icon("trash")}Delete all photos</button>
      <p class="foot-note" style="margin-top:12px">Deleting removes the file for good. Your check marks stay.</p>
    </section>`;
  $$(".compare img", body).forEach((img) => img.addEventListener("error", () => { if (Date.now() - fetchedAt > 60000) load(root); }, { once: true }));
}

function wireCloud(root) {
  root.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-select],[data-pid],[data-del-sel],[data-del-all],[data-take],[data-retry]");
    if (!t) return;
    if (t.hasAttribute("data-retry")) return load(root);
    if (t.hasAttribute("data-take")) return startPhoto(store.me.today, null);
    if (t.hasAttribute("data-select")) {
      haptic();
      selecting = !selecting;
      picked.clear();
      t.textContent = selecting ? "Cancel" : "Select";
      return paintCloud(root);
    }
    if (t.dataset.pid) {
      const p = photos.find((x) => x.id === t.dataset.pid);
      if (selecting) {
        haptic();
        picked.has(p.id) ? picked.delete(p.id) : picked.add(p.id);
        t.classList.toggle("picked");
        const b = $("[data-del-sel]", root);
        b.disabled = !picked.size;
        b.innerHTML = `${icon("trash")}Delete ${picked.size || ""}`;
        return;
      }
      return viewer(root, p);
    }
    if (t.hasAttribute("data-del-sel")) {
      const n = picked.size;
      const ok = await confirmSheet({
        title: `Delete ${n} photo${n > 1 ? "s" : ""}?`,
        body: "They're removed from the server for good. This can't be undone.",
        ok: "Delete", danger: true,
      });
      if (!ok) return;
      await deleteIds(root, [...picked]);
      selecting = false;
      picked.clear();
      renderPhotos(root.parentElement ? root : root);
    }
    if (t.hasAttribute("data-del-all")) {
      const ok = await confirmSheet({
        title: "Delete every photo?",
        body: `All ${photos.length} photo${photos.length > 1 ? "s" : ""} are removed from the server for good. Your progress and check marks stay.`,
        ok: "Delete all", danger: true,
      });
      if (!ok) return;
      try {
        await store.api("photos_delete_all");
        photos = [];
        selecting = false;
        toast("All photos deleted", { ico: "trash" });
        renderPhotos(root);
      } catch (err) { toast(errorText(err), { error: true }); }
    }
  });
}

async function deleteIds(root, ids) {
  try {
    let left = photos;
    for (const id of ids) {
      const r = await store.api("photo_delete", { id });
      left = r.photos;
    }
    photos = left;
    fetchedAt = Date.now();
    toast(ids.length > 1 ? `${ids.length} photos deleted` : "Photo deleted", { ico: "trash" });
  } catch (err) {
    toast(errorText(err), { error: true });
    invalidatePhotos();
  }
}

function viewer(root, p) {
  haptic();
  const v = document.createElement("div");
  v.className = "viewer";
  v.innerHTML = `<div class="viewer-bar"><button class="icon-btn" data-x aria-label="Close">${icon("x")}</button>
      <div style="text-align:center"><div class="h3" style="color:#fff">Day ${dayNum(store.start, p.day)}</div><div class="small" style="color:rgba(255,255,255,.6)">${esc(fmtShort(p.day))}</div></div>
      <span style="width:44px"></span></div>
    <img src="${esc(p.url)}" alt="Day ${dayNum(store.start, p.day)}">
    <div class="viewer-bar bottom"><span class="small" style="color:rgba(255,255,255,.6);display:flex;gap:6px;align-items:center">${icon("lock")}Only you</span>
      <button class="btn btn-sm btn-danger-solid" data-del>${icon("trash")}Delete</button></div>`;
  document.body.appendChild(v);
  $("[data-x]", v).onclick = () => v.remove();
  $("[data-del]", v).onclick = async () => {
    const ok = await confirmSheet({ title: "Delete this photo?", body: "It's removed from the server for good.", ok: "Delete", danger: true });
    if (!ok) return;
    await deleteIds(root, [p.id]);
    v.remove();
    renderPhotos(root);
  };
}

// ------------------------------------------------- Non-cloud modes
function renderLocal(root, mode) {
  const guide = {
    phone: `<div class="card card-pad"><div class="h3" style="margin-bottom:6px">How it works</div>
        <ol class="steps"><li>Tap <b>Take today's photo</b>. The camera opens.</li>
        <li>Tap <b>Save to Photos</b>, then <b>Save Image</b>.</li>
        <li>It's checked off. Nothing leaves your phone.</li></ol>
        <div class="tip">${icon("album")}<span>Make a <b>75 Hard</b> album in Photos so they're all in one place.</span></div></div>`,
    album: `<div class="card card-pad"><div class="h3" style="margin-bottom:6px">Your Shortcut</div>
        <p class="small" style="margin:0 0 14px">Tapping the photo task runs <b style="color:var(--t1)">75 Hard Photo</b>: camera, save to your 75 Hard album, then back here checked off.</p>
        <button class="btn btn-ghost btn-block" data-guide>${icon("bolt")}Setup guide</button></div>`,
    checkbox: `<div class="card card-pad"><div class="h3" style="margin-bottom:6px">Checkbox only</div>
        <p class="small" style="margin:0">Take your photo however you like. On Today, tap the photo task to check it off.</p></div>`,
  }[mode];

  root.innerHTML = `<div class="view">
    ${header()}
    ${privacy}
    <section class="section">${modeCard(mode)}</section>
    <section class="section">${guide}</section>
    ${mode !== "checkbox" ? todayCta() : ""}
    <section class="section">
      <button class="row card" data-settings style="border-radius:var(--r-l)">
        <span class="row-ico">${icon("cloud")}</span>
        <span class="txt"><span class="t" style="display:block">Want day 1 next to today?</span><span class="d" style="display:block">Switch to Keep them in the app, in Settings.</span></span>
        <span class="end">${icon("chevR")}</span></button>
    </section>
  </div>`;
  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-take],[data-guide],[data-settings]");
    if (!t) return;
    if (t.hasAttribute("data-take")) startPhoto(store.me.today, null);
    if (t.hasAttribute("data-guide")) shortcutGuide();
    if (t.hasAttribute("data-settings")) store.emit("nav:settings");
  });
}
