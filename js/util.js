import { icon } from "./icons.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmtCache = new Map();
function fmt(opts) {
  const k = JSON.stringify(opts);
  if (!fmtCache.has(k)) fmtCache.set(k, new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }));
  return fmtCache.get(k);
}
const asDate = (iso) => new Date(iso + "T12:00:00Z");
export const fmtLong = (iso) => fmt({ weekday: "long", month: "short", day: "numeric" }).format(asDate(iso));
export const fmtShort = (iso) => fmt({ weekday: "short", month: "short", day: "numeric" }).format(asDate(iso));
export const fmtMD = (iso) => fmt({ month: "short", day: "numeric" }).format(asDate(iso));
export const fmtWd = (iso) => fmt({ weekday: "narrow" }).format(asDate(iso));
export const fmtWdShort = (iso) => fmt({ weekday: "short" }).format(asDate(iso));
export const pad2 = (n) => String(n).padStart(2, "0");

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Light tap feedback. Android: vibrate. iOS 18+: the switch-input trick. */
export function haptic(kind = "light") {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(kind === "success" ? [12, 60, 18] : kind === "heavy" ? 18 : 8);
      return;
    }
    const lbl = document.getElementById("haptic");
    if (lbl) {
      lbl.click();
      if (kind === "success") setTimeout(() => lbl.click(), 110);
    }
  } catch (_) { /* ignore */ }
}

let toastTimer;
export function toast(msg, { error = false, ms = 2600, ico } = {}) {
  const root = document.getElementById("toast-root");
  root.innerHTML = "";
  const el = document.createElement("div");
  el.className = "toast" + (error ? " err" : "");
  el.setAttribute("role", "status");
  el.innerHTML = (ico || error ? icon(ico || "info") : "") + `<span>${esc(msg)}</span>`;
  root.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/** Bottom sheet. Returns { el, close }. `onClose` fires once. */
export function sheet(html, { onClose, dismissable = true } = {}) {
  const root = document.getElementById("sheet-root");
  const back = document.createElement("div");
  back.className = "sheet-backdrop";
  const el = document.createElement("div");
  el.className = "sheet";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="grab" aria-hidden="true"></div>${html}`;
  root.append(back, el);
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    back.classList.add("out");
    el.classList.add("out");
    setTimeout(() => { back.remove(); el.remove(); }, 300);
    onClose?.(result);
  };
  if (dismissable) back.addEventListener("click", () => close());

  // Swipe down to dismiss from the grab area / top of the sheet.
  let y0 = null, dy = 0;
  el.addEventListener("touchstart", (e) => {
    if (el.scrollTop > 0 || !dismissable) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener("touchend", () => {
    if (y0 == null) return;
    y0 = null;
    el.style.transition = "transform .25s cubic-bezier(.2,.8,.2,1)";
    if (dy > 110) { el.style.transform = ""; el.style.transition = ""; close(); }
    else { el.style.transform = ""; setTimeout(() => (el.style.transition = ""), 260); }
  });
  return { el, close };
}

/** Confirm sheet. Resolves true/false. */
export function confirmSheet({ title, body, ok = "Confirm", danger = false, cancel = "Cancel" }) {
  return new Promise((resolve) => {
    const s = sheet(
      `<h2 class="h2">${esc(title)}</h2><p class="body">${esc(body)}</p>
       <div class="actions">
         <button class="btn btn-block ${danger ? "btn-danger-solid" : "btn-primary"}" data-ok>${esc(ok)}</button>
         <button class="btn btn-block btn-ghost" data-cancel>${esc(cancel)}</button>
       </div>`,
      { onClose: (r) => resolve(!!r) },
    );
    s.el.querySelector("[data-ok]").onclick = () => { haptic(danger ? "heavy" : "light"); s.close(true); };
    s.el.querySelector("[data-cancel]").onclick = () => s.close(false);
  });
}

/** Little burst + card when a day closes. */
export function celebrate({ day, oneWorkout, partnerLine }) {
  const wrap = document.createElement("div");
  wrap.className = "celebrate";
  let rays = "";
  if (!reducedMotion()) {
    for (let i = 0; i < 16; i++) {
      const a = (360 / 16) * i;
      const color = i % 2 ? "var(--me)" : "var(--them)";
      rays += `<i class="ray" style="--a:${a}deg;background:${color};animation-delay:${(i % 4) * 0.03}s"></i>`;
    }
  }
  wrap.innerHTML = `${rays}<div class="card-c">
      <div class="eyebrow">Day complete</div>
      <div class="num" style="margin-top:14px">${pad2(day)}</div>
      <div class="h3">${oneWorkout ? "Done, with 1 workout" : "All six. Locked in."}</div>
      ${partnerLine ? `<div class="small">${esc(partnerLine)}</div>` : ""}
    </div>`;
  document.body.appendChild(wrap);
  haptic("success");
  setTimeout(() => wrap.remove(), 2900);
}

export function dataUrlToFile(dataUrl, name) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}
