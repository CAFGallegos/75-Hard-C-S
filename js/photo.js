// Progress photo flows. Four modes:
//  phone    — camera, then the iOS share sheet (Save Image). Nothing uploaded.
//  album    — runs the "75 Hard Photo" Shortcut, marks done on return.
//  cloud    — compressed upload to a private bucket (owner-only, server enforced).
//  checkbox — just a checkbox.
import { store } from "./store.js";
import { icon } from "./icons.js";
import { esc, sheet, haptic, toast } from "./util.js";
import { errorText } from "./api.js";
import { SHORTCUT_NAME } from "./config.js";
import { blank } from "./rules.js";

export const MODES = {
  phone: {
    icon: "phone",
    title: "Keep them on your phone",
    desc: "Snap it here, save it to your Photos. Nothing gets uploaded.",
  },
  album: {
    icon: "album",
    title: "Auto album",
    desc: "Same thing, but it drops them in a 75 Hard album for you. Takes a minute to set up.",
  },
  cloud: {
    icon: "cloud",
    title: "Keep them in the app",
    desc: "Private to you, and you can see day 1 next to today. Delete anything, anytime.",
  },
  checkbox: {
    icon: "checkbox",
    title: "Checkbox only",
    desc: "Take it however you like. The app just tracks that you did.",
  },
};

export function photoMeta(done) {
  const m = store.data.me.photo_mode;
  if (done) return ["Done", m === "cloud" ? "Saved privately" : m === "checkbox" ? "Checked" : "In your Photos"];
  return {
    phone: ["Opens camera", "Save to Photos"],
    album: ["Runs your Shortcut"],
    cloud: ["Opens camera", "Private to you"],
    checkbox: ["Tap when done"],
  }[m] ?? ["Daily"];
}

/** Open the camera / library picker. Must run inside a tap handler. */
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.getElementById("cam");
    input.value = "";
    const done = (f) => { input.onchange = null; input.oncancel = null; resolve(f); };
    input.onchange = () => done(input.files?.[0] ?? null);
    input.oncancel = () => done(null);
    input.click();
  });
}

export async function compress(file, max = 1600, quality = 0.82) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (_) {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width, h = src.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cw, ch);
  src.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

function setBusy(row, on) { row?.classList.toggle("busy", on); }

export async function startPhoto(day, row) {
  const mode = store.data.me.photo_mode;
  const e = store.entry(day) ?? blank(day);
  haptic();

  if (mode === "checkbox") return store.write(day, { photo: !e.photo });
  if (e.photo) return doneOptions(day, row, mode);

  if (mode === "phone") {
    const f = await pickImage();
    if (f) phoneSheet(day, f);
  } else if (mode === "cloud") {
    const f = await pickImage();
    if (f) await uploadCloud(day, f, row);
  } else if (mode === "album") {
    runShortcut(day);
  }
}

async function doneOptions(day, row, mode) {
  const again = mode === "album" ? "Run the Shortcut again" : mode === "cloud" ? "Retake (replaces this one)" : "Take another";
  const s = sheet(`<h2 class="h2">Photo's done</h2>
    <p class="body">${mode === "cloud" ? "It's saved privately. Only you can see it." : "Nice. Want to do anything else?"}</p>
    <div class="actions">
      <button class="btn btn-block btn-primary" data-again>${icon(mode === "album" ? "bolt" : "photo")}${again}</button>
      <button class="btn btn-block btn-ghost" data-undo>Mark as not done</button>
    </div>`);
  s.el.querySelector("[data-again]").onclick = async () => {
    s.close();
    if (mode === "album") return runShortcut(day);
    const f = await pickImage();
    if (!f) return;
    if (mode === "cloud") await uploadCloud(day, f, row);
    else phoneSheet(day, f);
  };
  s.el.querySelector("[data-undo]").onclick = () => { s.close(); store.write(day, { photo: false }); };
}

function phoneSheet(day, file) {
  const url = URL.createObjectURL(file);
  const firstTime = !store.data.me.tips?.album_tip;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const s = sheet(`<h2 class="h2">Save it to your Photos</h2>
    <img class="preview" src="${url}" alt="Your progress photo">
    <p class="body">${canShare ? "Tap Save, then choose <b>Save Image</b>." : "Save it to your Photos, then mark it done."} Nothing gets uploaded.</p>
    ${firstTime ? `<div class="tip">${icon("album")}<span><b>One-time tip:</b> make a <b>75 Hard</b> album in Photos and drop these in. Day 1 next to day 75 hits different.</span></div>` : ""}
    <div class="actions">
      <button class="btn btn-block btn-me" data-save>${icon("share")}${canShare ? "Save to Photos" : "Mark done"}</button>
      ${canShare ? `<button class="btn btn-block btn-ghost" data-skip>Already saved. Mark done</button>` : ""}
    </div>`, { onClose: () => URL.revokeObjectURL(url) });
  const finish = () => {
    s.close();
    store.write(day, { photo: true });
    if (firstTime) store.api("prefs", { tips: { album_tip: true } }).then((d) => store.setData(d, { quiet: true })).catch(() => {});
  };
  s.el.querySelector("[data-save]").onclick = async () => {
    if (!canShare) return finish();
    try {
      await navigator.share({ files: [file] });
      finish();
    } catch (err) {
      if (err?.name !== "AbortError") toast("Couldn't open the share sheet.", { error: true });
    }
  };
  s.el.querySelector("[data-skip]")?.addEventListener("click", finish);
}

async function uploadCloud(day, file, row) {
  setBusy(row, true);
  try {
    const data = await compress(file);
    const d = await store.api("photo_upload", { day, data });
    store.setData(d);
    haptic("success");
    toast("Saved. Only you can see it.", { ico: "lock" });
  } catch (err) {
    toast(errorText(err), { error: true });
  } finally {
    setBusy(row, false);
  }
}

// ----------------------------------------------------------- Shortcut flow
const PENDING = "album_pending";

export function shortcutGuide({ onReady } = {}) {
  const link = new URL(location.href);
  link.search = "";
  link.searchParams.set("k", store.k);
  link.searchParams.set("photo", "done");
  const s = sheet(`<div class="eyebrow" style="margin-bottom:10px">Auto album · one-time setup</div>
    <h2 class="h2">Build the "75 Hard Photo" Shortcut</h2>
    <p class="body" style="margin-bottom:6px">About a minute. You only do this once.</p>
    <ol class="steps">
      <li>In <b>Photos</b>, make an album called <b>75 Hard</b>.</li>
      <li>Open the <b>Shortcuts</b> app and tap <b>+</b> to make a new shortcut. Name it exactly <b>${esc(SHORTCUT_NAME)}</b>.</li>
      <li>Add the action <b>Take Photo</b>. Leave "Show Camera Preview" on.</li>
      <li>Add <b>Save to Photo Album</b> and pick the <b>75 Hard</b> album.</li>
      <li>Add <b>Open URLs</b> and paste your private link:
        <span class="code" data-link>${esc(link.toString())}</span>
        <button class="btn btn-sm btn-ghost" style="margin-top:10px" data-copy>${icon("link")}Copy link</button></li>
      <li>Tap <b>Done</b>. Back here, tap the photo task to run it.</li>
    </ol>
    <div class="tip">${icon("info")}<span>The link brings you back and checks off the photo. Keep it private, it's your key.</span></div>
    <div class="actions">
      <button class="btn btn-block btn-me" data-ready>${icon("bolt")}I built it. Run it</button>
      <button class="btn btn-block btn-ghost" data-later>Later</button>
    </div>`);
  s.el.querySelector("[data-copy]").onclick = async () => {
    try { await navigator.clipboard.writeText(link.toString()); toast("Link copied", { ico: "check" }); haptic(); }
    catch (_) { toast("Press and hold the link to copy it."); }
  };
  s.el.querySelector("[data-ready]").onclick = () => {
    s.close();
    store.api("prefs", { tips: { shortcut_ready: true } }).then((d) => store.setData(d, { quiet: true })).catch(() => {});
    onReady?.();
  };
  s.el.querySelector("[data-later]").onclick = () => s.close();
}

export function runShortcut(day) {
  if (!store.data.me.tips?.shortcut_ready) return shortcutGuide({ onReady: () => runShortcut(day) });
  try { sessionStorage.setItem(PENDING, JSON.stringify({ day, at: Date.now() })); } catch (_) {}
  store.api("photo_pending", { day }).catch(() => {});
  location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
}

/** Called when the app becomes visible again. */
export async function checkShortcutReturn() {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(PENDING) || "null"); } catch (_) {}
  if (!p || Date.now() - p.at < 2500) return;
  try { sessionStorage.removeItem(PENDING); } catch (_) {}
  if (Date.now() - p.at > 30 * 60 * 1000) return;
  try {
    const d = await store.api("photo_return");
    store.setData(d);
    haptic("success");
    toast("Photo's in your 75 Hard album", { ico: "check" });
  } catch (err) {
    toast(errorText(err), { error: true });
  }
}

export async function changeMode(mode) {
  const d = await store.api("prefs", { photo_mode: mode });
  store.setData(d);
}

